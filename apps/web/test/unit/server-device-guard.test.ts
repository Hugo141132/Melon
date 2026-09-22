import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateServerDeviceAccess } from '@/lib/auth/server-device-guard';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

let mockCookieStore: Record<string, string | undefined> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockCookieStore[name] ? { name, value: mockCookieStore[name] } : undefined,
  }),
}));

const mockValidateSession = vi.fn();
const mockUserDeviceAccessFindFirst = vi.fn();

vi.mock('@kebun-melon/database', () => ({
  prisma: {
    userDeviceAccess: {
      findFirst: (...args: any[]) => mockUserDeviceAccessFindFirst(...args),
    },
  },
  SESSION_COOKIE_NAME: 'session_token',
  validateSession: (...args: any[]) => mockValidateSession(...args),
}));

describe('Server Device Guard & Access Revocation Authorization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore = {};
  });

  it('1. Returns AUTHORIZED when no target deviceId is specified (bare overview route)', async () => {
    const result = await validateServerDeviceAccess(null);
    expect(result.status).toBe('AUTHORIZED');

    const emptyResult = await validateServerDeviceAccess('');
    expect(emptyResult.status).toBe('AUTHORIZED');
  });

  it('2. Returns UNAUTHENTICATED when session_token cookie is missing', async () => {
    mockCookieStore = {};
    const result = await validateServerDeviceAccess('device-a');
    expect(result.status).toBe('UNAUTHENTICATED');
    expect(result.code).toBe('UNAUTHENTICATED');
  });

  it('3. OWNER access: Global device scope allows access to any device without user_device_access record', async () => {
    mockCookieStore['session_token'] = 'owner-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-owner', userId: 'usr-owner-1' },
      user: {
        id: 'usr-owner-1',
        email: 'owner@melon.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    });

    const result = await validateServerDeviceAccess('device-any-123');
    expect(result.status).toBe('AUTHORIZED');
    expect(result.isOwner).toBe(true);
    expect(result.userId).toBe('usr-owner-1');
    expect(mockUserDeviceAccessFindFirst).not.toHaveBeenCalled();
  });

  it('4. ADMIN assigned access: Grants access when user has active (revokedAt: null) assignment', async () => {
    mockCookieStore['session_token'] = 'admin-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-admin', userId: 'usr-admin-1' },
      user: {
        id: 'usr-admin-1',
        email: 'admin@melon.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    });

    mockUserDeviceAccessFindFirst.mockResolvedValueOnce({
      id: 'access-1',
      userId: 'usr-admin-1',
      deviceId: 'device-assigned-uuid',
      revokedAt: null,
    });

    const result = await validateServerDeviceAccess('device-assigned-uuid');
    expect(result.status).toBe('AUTHORIZED');
    expect(result.isOwner).toBe(false);
    expect(result.userId).toBe('usr-admin-1');
    expect(mockUserDeviceAccessFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'usr-admin-1',
          revokedAt: null,
        }),
      })
    );
  });

  it('5. ADMIN revoked access: Rejects with FORBIDDEN (DEVICE_NOT_ASSIGNED) when access is revoked', async () => {
    mockCookieStore['session_token'] = 'admin-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-admin', userId: 'usr-admin-1' },
      user: {
        id: 'usr-admin-1',
        email: 'admin@melon.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    });

    // Revoked or non-existent active assignment returns null because query filters revokedAt: null
    mockUserDeviceAccessFindFirst.mockResolvedValueOnce(null);

    const result = await validateServerDeviceAccess('device-revoked-uuid');
    expect(result.status).toBe('FORBIDDEN');
    expect(result.code).toBe('DEVICE_NOT_ASSIGNED');
    expect(result.isOwner).toBe(false);
    expect(result.message).toContain('is not assigned to user or access has been revoked');
  });

  it('6. ADMIN access to another assigned device: Device B allowed while Device A is revoked', async () => {
    // Check Device A (revoked)
    mockCookieStore['session_token'] = 'admin-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-admin', userId: 'usr-admin-1' },
      user: {
        id: 'usr-admin-1',
        email: 'admin@melon.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    });
    mockUserDeviceAccessFindFirst.mockResolvedValueOnce(null);

    const resultDevA = await validateServerDeviceAccess('device-a-revoked');
    expect(resultDevA.status).toBe('FORBIDDEN');
    expect(resultDevA.code).toBe('DEVICE_NOT_ASSIGNED');

    // Check Device B (active assignment)
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-admin', userId: 'usr-admin-1' },
      user: {
        id: 'usr-admin-1',
        email: 'admin@melon.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    });
    mockUserDeviceAccessFindFirst.mockResolvedValueOnce({
      id: 'access-b',
      userId: 'usr-admin-1',
      deviceId: 'device-b-active',
      revokedAt: null,
    });

    const resultDevB = await validateServerDeviceAccess('device-b-active');
    expect(resultDevB.status).toBe('AUTHORIZED');
    expect(resultDevB.isOwner).toBe(false);
  });
});
