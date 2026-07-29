import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

describe('POST /api/v1/auth/register Route Handler Unit Tests', () => {
  it('1. Returns 201 Created and safe user DTO on valid registration', async () => {
    const validBody = {
      fullName: 'Route Admin',
      email: 'routeadmin@example.com',
      password: 'StrongPassword123!',
    };

    const mockSafeUser = {
      id: '00000000-0000-0000-0000-000000000001',
      fullName: 'Route Admin',
      email: 'routeadmin@example.com',
      username: null,
      accountStatus: AccountStatus.PENDING_APPROVAL,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      activeRoles: [UserRole.ADMIN],
    };

    vi.spyOn(dbModule, 'registerAdminUser').mockResolvedValueOnce({
      user: mockSafeUser as any,
    });

    const req = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe('routeadmin@example.com');
    expect(json.data.user.accountStatus).toBe('PENDING_APPROVAL');

    // Security check: Verify no secret fields leak in response JSON
    const responseString = JSON.stringify(json);
    expect(responseString).not.toContain('password');
    expect(responseString).not.toContain('passwordHash');
    expect(responseString).not.toContain('$argon2id$');
  });

  it('2. Returns 400 Bad Request on invalid payload or extraneous injected fields', async () => {
    const injectedBody = {
      fullName: 'Attacker',
      email: 'attacker@example.com',
      password: 'StrongPassword123!',
      role: 'OWNER',
    };

    const req = new Request('http://localhost:3000/api/v1/auth/register', {
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

  it('3. Returns 409 Conflict on duplicate email', async () => {
    vi.spyOn(dbModule, 'registerAdminUser').mockRejectedValueOnce(
      new dbModule.DuplicateEmailError('duplicate@example.com')
    );

    const req = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Admin Dup',
        email: 'duplicate@example.com',
        password: 'StrongPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('4. Returns 422 Unprocessable Entity on password policy failure', async () => {
    vi.spyOn(dbModule, 'registerAdminUser').mockRejectedValueOnce(
      new dbModule.PasswordPolicyError('Password must be at least 12 characters long.')
    );

    const req = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Weak Admin',
        email: 'weak@example.com',
        password: 'weak',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PASSWORD_POLICY_FAILED');
  });

  it('5. Returns 503 Service Unavailable on missing ADMIN role', async () => {
    vi.spyOn(dbModule, 'registerAdminUser').mockRejectedValueOnce(
      new dbModule.MissingRoleError('ADMIN')
    );

    const req = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Admin Candidate',
        email: 'norole@example.com',
        password: 'StrongPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
