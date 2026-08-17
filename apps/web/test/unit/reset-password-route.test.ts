import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../../app/api/v1/auth/reset-password/route';
import { clearRateLimitStore } from '../../lib/rate-limit';
import { UserRepository } from '@kebun-melon/database';

describe('TASK-0213 POST /api/v1/auth/reset-password Unit Tests', () => {
  const origMax = process.env.RATE_LIMIT_RESET_PASSWORD_MAX;

  beforeEach(() => {
    clearRateLimitStore();
    process.env.RATE_LIMIT_RESET_PASSWORD_MAX = '5';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (origMax !== undefined) process.env.RATE_LIMIT_RESET_PASSWORD_MAX = origMax;
    else delete process.env.RATE_LIMIT_RESET_PASSWORD_MAX;
  });

  it('successfully resets password for valid single-use token', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: true,
      revokedSessionsCount: 2,
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        fullName: 'Valid User',
        email: 'user@example.com',
        username: 'validuser',
        accountStatus: 'ACTIVE' as any,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: ['ADMIN' as any],
      },
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.10',
      },
      body: JSON.stringify({
        token: 'valid-reset-token-64chars',
        newPassword: 'NewSecurePassword123!',
        newPasswordConfirmation: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('successfully reset');
    expect(json.data.user.email).toBe('user@example.com');
    expect(json.data.revokedSessionsCount).toBe(2);
  });

  it('rejects password confirmation mismatch with 422 PASSWORD_CONFIRMATION_MISMATCH', async () => {
    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.11',
      },
      body: JSON.stringify({
        token: 'valid-reset-token',
        newPassword: 'NewSecurePassword123!',
        newPasswordConfirmation: 'DifferentPassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PASSWORD_CONFIRMATION_MISMATCH');
  });

  it('rejects invalid or unknown reset token with 400 INVALID_TOKEN', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid or unknown password reset token.',
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.12',
      },
      body: JSON.stringify({
        token: 'invalid-token',
        newPassword: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects expired reset token with 400 TOKEN_EXPIRED', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'This password reset token has expired.',
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.13',
      },
      body: JSON.stringify({
        token: 'expired-token',
        newPassword: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects already used token with 400 TOKEN_ALREADY_USED (replay attack protection)', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: false,
      error: 'TOKEN_ALREADY_USED',
      message: 'This password reset token has already been used.',
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.14',
      },
      body: JSON.stringify({
        token: 'replayed-token',
        newPassword: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOKEN_ALREADY_USED');
  });

  it('rejects weak new password with 422 WEAK_PASSWORD', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: false,
      error: 'WEAK_PASSWORD',
      message:
        'Password must be at least 12 characters and include uppercase, lowercase, numbers, and special characters.',
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.15',
      },
      body: JSON.stringify({
        token: 'valid-token',
        newPassword: 'weak',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('WEAK_PASSWORD');
  });

  it('successfully resets password for non-active account (e.g. PENDING_APPROVAL) preserving status', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: true,
      revokedSessionsCount: 0,
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        fullName: 'Pending Admin',
        email: 'pending@example.com',
        username: 'pendingadmin',
        accountStatus: 'PENDING_APPROVAL' as any,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: ['ADMIN' as any],
      },
    });

    const req = new Request('http://localhost/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.16',
      },
      body: JSON.stringify({
        token: 'valid-token',
        newPassword: 'NewSecurePassword123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe('pending@example.com');
  });

  it('enforces rate limiting returning 429 when max limit is exceeded', async () => {
    vi.spyOn(UserRepository.prototype, 'resetPasswordWithToken').mockResolvedValue({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid token',
    });

    const makeReq = () =>
      new Request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.17',
        },
        body: JSON.stringify({
          token: 'token',
          newPassword: 'NewSecurePassword123!',
        }),
      });

    // 5 requests allowed (RATE_LIMIT_RESET_PASSWORD_MAX = 5)
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(400);
    }

    // 6th request blocked with 429
    const blockedRes = await POST(makeReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();

    const json = await blockedRes.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
