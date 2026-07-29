import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

describe('POST /api/v1/auth/login Route Handler Unit Tests', () => {
  it('1. Returns 200 OK, sets session_token cookie, and returns safe user DTO on valid credentials', async () => {
    const validBody = {
      email: 'admin@example.com',
      password: 'StrongPassword123!',
    };

    const mockLoginResult = {
      rawToken: 'mock-raw-token-12345678901234567890',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        fullName: 'Active Admin',
        email: 'admin@example.com',
        username: null,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    };

    vi.spyOn(dbModule, 'loginUser').mockResolvedValueOnce(mockLoginResult as any);

    const req = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe('admin@example.com');
    expect(json.data.user.role).toBe('ADMIN');
    expect(json.data.user.accountStatus).toBe('ACTIVE');

    // Cookie headers check
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('session_token=mock-raw-token-12345678901234567890');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie?.toLowerCase()).toContain('samesite=strict');

    // Secrecy check
    const resString = JSON.stringify(json);
    expect(resString).not.toContain('password');
    expect(resString).not.toContain('rawToken');
  });

  it('2. Returns 401 Unauthorized INVALID_CREDENTIALS on invalid credentials', async () => {
    vi.spyOn(dbModule, 'loginUser').mockRejectedValueOnce(new dbModule.InvalidCredentialsError());

    const req = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrong@example.com',
        password: 'WrongPassword!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('3. Returns 403 Forbidden with exact status code on non-ACTIVE accounts', async () => {
    vi.spyOn(dbModule, 'loginUser').mockRejectedValueOnce(
      new dbModule.AccountStatusForbiddenError(AccountStatus.PENDING_APPROVAL)
    );

    const req = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pending@example.com',
        password: 'ValidPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
  });

  it('4. Returns 400 Bad Request on invalid payload format or extra fields', async () => {
    const injectedBody = {
      email: 'attacker@example.com',
      password: 'Password123!',
      role: 'OWNER',
    };

    const req = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(injectedBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
