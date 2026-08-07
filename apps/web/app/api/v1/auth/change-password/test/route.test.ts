import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

let mockCookieToken: string | undefined = 'valid-session-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

describe('POST /api/v1/auth/change-password Route Handler Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCookieToken = 'valid-session-token';
  });

  it('1. Returns 401 UNAUTHENTICATED when unauthenticated request sent', async () => {
    mockCookieToken = undefined;

    const req = new Request('http://localhost:3000/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'NewPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('2. Returns 422 PASSWORD_CONFIRMATION_MISMATCH when passwords do not match', async () => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: {
        id: 's1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
      },
      user: {
        id: 'u1',
        fullName: 'Active User',
        email: 'user@example.com',
        username: 'user1',
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    const req = new Request('http://localhost:3000/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'DifferentPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PASSWORD_CONFIRMATION_MISMATCH');
  });

  it('3. Returns 422 WEAK_PASSWORD when password policy fails', async () => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: {
        id: 's1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
      },
      user: {
        id: 'u1',
        fullName: 'Active User',
        email: 'user@example.com',
        username: 'user1',
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    vi.spyOn(dbModule.UserRepository.prototype, 'changeUserPassword').mockResolvedValueOnce({
      success: false,
      error: 'WEAK_PASSWORD',
      message: 'Password must be at least 12 characters long.',
    });

    const req = new Request('http://localhost:3000/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'short',
        newPasswordConfirmation: 'short',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('WEAK_PASSWORD');
  });

  it('4. Returns 204 No Content and clears session cookie on successful password change', async () => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: {
        id: 's1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
      },
      user: {
        id: 'u1',
        fullName: 'Active User',
        email: 'user@example.com',
        username: 'user1',
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    vi.spyOn(dbModule.UserRepository.prototype, 'changeUserPassword').mockResolvedValueOnce({
      success: true,
      revokedSessionsCount: 2,
      user: {
        id: 'u1',
        fullName: 'Active User',
        email: 'user@example.com',
        username: 'user1',
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    const req = new Request('http://localhost:3000/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'OldSecurePassword123!',
        newPassword: 'NewSecurePassword123!',
        newPasswordConfirmation: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('session_token=;');
    expect(setCookie).toContain('Max-Age=0');
  });
});
