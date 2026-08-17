import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../../app/api/v1/auth/forgot-password/route';
import { clearRateLimitStore } from '../../lib/rate-limit';
import * as resendModule from '../../lib/email/resend';
import { UserRepository } from '@kebun-melon/database';

describe('TASK-0213 POST /api/v1/auth/forgot-password Unit Tests', () => {
  const origMax = process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX;

  beforeEach(() => {
    clearRateLimitStore();
    process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX = '3';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (origMax !== undefined) process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX = origMax;
    else delete process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX;
  });

  it('anti-enumeration guarantee: returns 200 generic message when user does NOT exist', async () => {
    vi.spyOn(UserRepository.prototype, 'createPasswordResetToken').mockResolvedValue({
      success: false,
      userExists: false,
    });

    const sendEmailSpy = vi.spyOn(resendModule, 'sendPasswordResetEmail').mockResolvedValue({
      success: true,
      emailSent: true,
    });

    const req = new Request('http://localhost/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.1',
      },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('If an account exists with that email');
    expect(json.data).toBeUndefined(); // Never leak user details

    // Email send should NOT be triggered for non-existent user
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  it('anti-enumeration guarantee: returns exact same 200 generic message when user EXISTS and is active', async () => {
    vi.spyOn(UserRepository.prototype, 'createPasswordResetToken').mockResolvedValue({
      success: true,
      rawToken: 'mock-raw-token-1234567890123456789012345678901234567890123456789012345678901234',
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        fullName: 'Active User',
        email: 'active@example.com',
        username: 'activeuser',
        accountStatus: 'ACTIVE' as any,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: ['ADMIN' as any],
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const sendEmailSpy = vi.spyOn(resendModule, 'sendPasswordResetEmail').mockResolvedValue({
      success: true,
      emailSent: true,
    });

    const req = new Request('http://localhost/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.2',
      },
      body: JSON.stringify({ email: 'active@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('If an account exists with that email');
    expect(json.data).toBeUndefined();

    // Email send should be triggered with token
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: 'active@example.com',
        recipientName: 'Active User',
      })
    );
  });

  it('anti-enumeration guarantee: returns exact same 200 response even if email delivery fails', async () => {
    vi.spyOn(UserRepository.prototype, 'createPasswordResetToken').mockResolvedValue({
      success: true,
      rawToken: 'mock-raw-token',
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        fullName: 'Active User',
        email: 'active@example.com',
        username: null,
        accountStatus: 'ACTIVE' as any,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [],
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Email dispatch reports failure
    vi.spyOn(resendModule, 'sendPasswordResetEmail').mockResolvedValue({
      success: false,
      emailSent: false,
      error: 'Resend API rate limit exceeded',
    });

    const req = new Request('http://localhost/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.3',
      },
      body: JSON.stringify({ email: 'active@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('If an account exists with that email');
  });

  it('returns 400 VALIDATION_ERROR on invalid email format', async () => {
    const req = new Request('http://localhost/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.4',
      },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when extra unapproved fields are injected (strict schema)', async () => {
    const req = new Request('http://localhost/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.5',
      },
      body: JSON.stringify({ email: 'user@example.com', role: 'OWNER' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces rate limiting returning 429 when max limit is exceeded', async () => {
    vi.spyOn(UserRepository.prototype, 'createPasswordResetToken').mockResolvedValue({
      success: false,
      userExists: false,
    });

    const makeReq = () =>
      new Request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.6',
        },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

    // 3 requests allowed (RATE_LIMIT_FORGOT_PASSWORD_MAX = 3)
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(200);
    }

    // 4th request blocked with 429
    const blockedRes = await POST(makeReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();

    const json = await blockedRes.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
