import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as resendVerificationPost } from '../../app/api/v1/auth/resend-verification/route';
import { POST as verifyEmailPost } from '../../app/api/v1/auth/verify-email/route';
import { clearRateLimitStore } from '../../lib/rate-limit';
import * as resendModule from '../../lib/email/resend';
import { UserRepository, prisma } from '@kebun-melon/database';

describe('TASK-0214 Email Verification Routes Unit Tests', () => {
  beforeEach(() => {
    clearRateLimitStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('anti-enumeration guarantee: returns 200 generic message when user does NOT exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const createTokenSpy = vi.spyOn(UserRepository.prototype, 'createEmailVerificationToken');
      const sendEmailSpy = vi.spyOn(resendModule, 'sendVerificationEmail');

      const req = new Request('http://localhost/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.10',
        },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('If the email is registered and unverified');
      expect(json.data).toBeUndefined(); // Never leak user details

      expect(createTokenSpy).not.toHaveBeenCalled();
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('anti-enumeration guarantee: returns 200 generic message when user is ALREADY verified', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        fullName: 'Verified Owner',
        email: 'verified.owner@example.com',
        username: 'verifiedowner',
        passwordHash: 'dummy',
        accountStatus: 'ACTIVE' as any,
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const createTokenSpy = vi.spyOn(UserRepository.prototype, 'createEmailVerificationToken');
      const sendEmailSpy = vi.spyOn(resendModule, 'sendVerificationEmail');

      const req = new Request('http://localhost/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.11',
        },
        body: JSON.stringify({ email: 'verified.owner@example.com' }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('If the email is registered and unverified');

      expect(createTokenSpy).not.toHaveBeenCalled();
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('generates hashed token and triggers Resend delivery when user is unverified', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        fullName: 'Unverified Owner',
        email: 'owner@example.com',
        username: null,
        passwordHash: 'dummy',
        accountStatus: 'ACTIVE' as any,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const createTokenSpy = vi
        .spyOn(UserRepository.prototype, 'createEmailVerificationToken')
        .mockResolvedValue({
          success: true,
          rawToken: 'mock-verification-token-raw-cprng-32bytes',
          user: {
            id: '22222222-2222-2222-2222-222222222222',
            fullName: 'Unverified Owner',
            email: 'owner@example.com',
            username: null,
            accountStatus: 'ACTIVE' as any,
            emailVerifiedAt: null,
            lastLoginAt: null,
            suspendedAt: null,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            activeRoles: ['OWNER' as any],
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

      const sendEmailSpy = vi.spyOn(resendModule, 'sendVerificationEmail').mockResolvedValue({
        success: true,
        emailSent: true,
      });

      const req = new Request('http://localhost/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.12',
        },
        body: JSON.stringify({ email: '  Owner@EXAMPLE.COM  ' }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('If the email is registered and unverified');

      expect(createTokenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '22222222-2222-2222-2222-222222222222',
        })
      );
      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'owner@example.com',
          recipientName: 'Unverified Owner',
          rawToken: 'mock-verification-token-raw-cprng-32bytes',
        })
      );
    });

    it('returns 400 VALIDATION_ERROR on invalid email or injected properties', async () => {
      const req = new Request('http://localhost/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.13',
        },
        body: JSON.stringify({ email: 'invalid-email', extra: 'bad' }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces rate limit of 3 requests per IP window', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const makeReq = () =>
        new Request('http://localhost/api/v1/auth/resend-verification', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.14',
          },
          body: JSON.stringify({ email: 'rate@example.com' }),
        });

      for (let i = 0; i < 3; i++) {
        const res = await resendVerificationPost(makeReq());
        expect(res.status).toBe(200);
      }

      const blockedRes = await resendVerificationPost(makeReq());
      expect(blockedRes.status).toBe(429);
      const json = await blockedRes.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('successfully consumes token, marks email verified, returns 200 without session cookie', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: true,
        user: {
          id: '22222222-2222-2222-2222-222222222222',
          fullName: 'Verified Owner',
          email: 'owner@example.com',
          username: null,
          accountStatus: 'ACTIVE' as any,
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: ['OWNER' as any],
        },
      });

      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.20',
        },
        body: JSON.stringify({ token: 'mock-valid-token-32bytes-hex' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('owner@example.com');
      expect(json.data.user.accountStatus).toBe('ACTIVE');
      expect(json.data.user.emailVerifiedAt).toBeDefined();

      // Crucial: Must NEVER set session cookies on verification endpoint
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('returns 400 when token is invalid or expired', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid or missing email verification token.',
      });

      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.21',
        },
        body: JSON.stringify({ token: 'invalid-token' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_TOKEN');
    });

    it('returns 400 on empty token payload (schema validation)', async () => {
      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.22',
        },
        body: JSON.stringify({ token: '' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
