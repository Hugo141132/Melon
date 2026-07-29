import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';
import * as dbModule from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

let mockCookieToken: string | undefined = 'valid-session-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

describe('GET /api/v1/auth/session Route Handler Unit Tests', () => {
  it('1. Returns authenticated: true and safe user data for valid session', async () => {
    mockCookieToken = 'valid-session-token';

    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: {
        id: 'session-uuid-1234',
        userId: 'user-uuid-1234',
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
      },
      user: {
        id: 'user-uuid-1234',
        fullName: 'Session User',
        email: 'session@example.com',
        username: null,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.OWNER],
      },
    });

    const req = new Request('http://localhost:3000/api/v1/auth/session', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.authenticated).toBe(true);
    expect(json.data.user.email).toBe('session@example.com');
    expect(json.data.user.role).toBe('OWNER');
    expect(json.data.user.accountStatus).toBe('ACTIVE');
  });

  it('2. Returns authenticated: false and clears cookie when session is missing or expired', async () => {
    mockCookieToken = undefined;

    const req = new Request('http://localhost:3000/api/v1/auth/session', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.authenticated).toBe(false);
    expect(json.data.user).toBeNull();
  });

  it('3. Returns authenticated: false when validateSession returns null for invalid/expired token', async () => {
    mockCookieToken = 'expired-token';

    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce(null);

    const req = new Request('http://localhost:3000/api/v1/auth/session', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.authenticated).toBe(false);
    expect(json.data.user).toBeNull();

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('session_token=;');
    expect(setCookie).toContain('Max-Age=0');
  });
});
