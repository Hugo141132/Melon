import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../../app/api/v1/realtime/stream/route';
import { realtimeEventHub } from '../../lib/realtime/event-hub';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import { SESSION_COOKIE_NAME } from '@kebun-melon/database';

vi.mock('@kebun-melon/database', async () => {
  const actual = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    validateSession: vi.fn(),
    verifyStreamSessionActive: vi.fn(),
    prisma: {
      userDeviceAccess: {
        findFirst: vi.fn(),
      },
    },
  };
});

import { validateSession, verifyStreamSessionActive, prisma } from '@kebun-melon/database';

describe('TASK-0505 & TASK-0908 Realtime Stream API (GET /api/v1/realtime/stream) Test Suite', () => {
  const VALID_TOKEN = 'valid-session-token-123';
  const VALID_USER_ID = '10000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeEventHub.clearListeners();
    process.env.TEST_HEARTBEAT_INTERVAL_MS = '50';
  });

  afterEach(() => {
    delete process.env.TEST_HEARTBEAT_INTERVAL_MS;
  });

  it('returns 401 UNAUTHENTICATED when no session cookie or Bearer token is provided', async () => {
    const request = new Request('http://localhost:3000/api/v1/realtime/stream');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 INVALID_SESSION when session token is invalid or revoked', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/v1/realtime/stream', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=revoked-token` },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_SESSION');
  });

  it('returns 403 ACCOUNT_NOT_ACTIVE when user account is not ACTIVE', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: 'suspended-token',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Suspended Admin',
        email: 'suspended@example.com',
        accountStatus: AccountStatus.SUSPENDED,
        activeRoles: [UserRole.ADMIN],
      },
    } as any);

    const request = new Request('http://localhost:3000/api/v1/realtime/stream', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=suspended-token` },
    });
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('returns 403 DEVICE_NOT_ASSIGNED when Admin requests unassigned device stream', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Admin User',
        email: 'admin@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    } as any);

    vi.mocked(prisma.userDeviceAccess.findFirst).mockResolvedValue(null); // Unassigned

    const request = new Request(
      'http://localhost:3000/api/v1/realtime/stream?deviceId=unassigned-device-001',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
      }
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DEVICE_NOT_ASSIGNED');
  });

  it('returns 200 OK text/event-stream headers and emits initial connected event', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    } as any);

    vi.mocked(verifyStreamSessionActive).mockResolvedValue(true);

    const request = new Request('http://localhost:3000/api/v1/realtime/stream', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: connected');
    expect(text).toContain('CONNECTED');

    reader!.cancel();
  });

  it('filters broadcast events by target deviceId and channel', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    } as any);

    vi.mocked(verifyStreamSessionActive).mockResolvedValue(true);

    const request = new Request(
      'http://localhost:3000/api/v1/realtime/stream?deviceId=water-node-001&channels=commands',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
      }
    );
    const response = await GET(request);
    const reader = response.body?.getReader();

    // Read initial connected event
    await reader!.read();

    // Publish non-matching device event -> should be ignored
    realtimeEventHub.publish({
      name: 'faucet.command.updated',
      deviceId: 'other-node-999',
      data: { commandId: 'cmd-999', status: 'COMPLETED' },
    });

    // Publish matching device & matching channel event
    realtimeEventHub.publish({
      name: 'faucet.command.updated',
      deviceId: 'water-node-001',
      data: { commandId: 'cmd-100', status: 'IN_PROGRESS' },
    });

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: faucet.command.updated');
    expect(text).toContain('cmd-100');

    reader!.cancel();
  });

  it('closes stream with session.expired event when verifyStreamSessionActive returns false (TASK-0908)', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    } as any);

    // Stream session active revalidation fails
    vi.mocked(verifyStreamSessionActive).mockResolvedValue(false);

    const request = new Request('http://localhost:3000/api/v1/realtime/stream', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
    });
    const response = await GET(request);
    const reader = response.body?.getReader();

    // Read connected
    await reader!.read();

    // Wait for heartbeat revalidation tick (50ms)
    await new Promise((res) => setTimeout(res, 80));

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: session.expired');
    expect(text).toContain('SESSION_EXPIRED_OR_REVOKED');

    reader!.cancel();
  });

  it('closes stream with access.revoked event when Admin device access is revoked (TASK-0908)', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce({
      id: 'sess-1',
      userId: VALID_USER_ID,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      revokedAt: null,
      user: {
        id: VALID_USER_ID,
        fullName: 'Admin User',
        email: 'admin@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    } as any);

    vi.mocked(verifyStreamSessionActive).mockResolvedValue(true);
    // Initial check: assigned
    vi.mocked(prisma.userDeviceAccess.findFirst)
      .mockResolvedValueOnce({ id: 'access-1' } as any)
      // Tick check: revoked (null)
      .mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000/api/v1/realtime/stream?deviceId=water-node-001',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
      }
    );
    const response = await GET(request);
    const reader = response.body?.getReader();

    // Read connected
    await reader!.read();

    // Wait for tick revalidation (50ms)
    await new Promise((res) => setTimeout(res, 80));

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: access.revoked');
    expect(text).toContain('DEVICE_ACCESS_REVOKED');

    reader!.cancel();
  });
});
