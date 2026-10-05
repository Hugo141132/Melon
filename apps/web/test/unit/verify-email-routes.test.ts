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
          rawToken: '123456',
          code: '123456',
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
          code: '123456',
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

    it('notifies active OWNERs via email and SSE when a PENDING_APPROVAL user verifies email', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: true,
        user: {
          id: 'admin-applicant-uuid-999',
          fullName: 'Calon Admin Baru',
          email: 'calon.admin@example.com',
          username: null,
          accountStatus: 'PENDING_APPROVAL' as any,
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: ['ADMIN' as any],
        },
      });

      const findManyOwnersSpy = vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
        {
          id: 'owner-uuid-1',
          email: 'owner@kebunmelon.com',
          fullName: 'Budi Santoso',
          userPreference: {
            preferredLocale: 'id',
          },
        } as any,
      ]);

      const sendApprovalEmailSpy = vi
        .spyOn(resendModule, 'sendAdminApprovalRequestEmail')
        .mockResolvedValue({ success: true, emailSent: true, id: 'email-id-999' });

      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.25',
        },
        body: JSON.stringify({ token: 'valid-admin-token' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.accountStatus).toBe('PENDING_APPROVAL');

      expect(findManyOwnersSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: {
              some: {
                role: { code: 'OWNER' },
                revokedAt: null,
              },
            },
            accountStatus: 'ACTIVE',
            emailVerifiedAt: { not: null },
          }),
        })
      );
      expect(sendApprovalEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'owner@kebunmelon.com',
          applicantEmail: 'calon.admin@example.com',
          applicantName: 'Calon Admin Baru',
        })
      );
    });

    it('keeps verification successful when Resend provider rejects approval email', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: true,
        user: {
          id: 'admin-applicant-uuid-999',
          fullName: 'Calon Admin Baru',
          email: 'calon.admin@example.com',
          username: null,
          accountStatus: 'PENDING_APPROVAL' as any,
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: ['ADMIN' as any],
        },
      });

      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
        {
          id: 'owner-uuid-1',
          email: 'owner@kebunmelon.com',
          fullName: 'Budi Santoso',
          userPreference: {
            preferredLocale: 'en',
          },
        } as any,
      ]);

      const sendApprovalEmailSpy = vi
        .spyOn(resendModule, 'sendAdminApprovalRequestEmail')
        .mockResolvedValue({
          success: false,
          emailSent: false,
          error: 'Domain verification failed',
        });

      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.26',
        },
        body: JSON.stringify({ token: 'valid-admin-token-rejected-send' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.accountStatus).toBe('PENDING_APPROVAL');
      expect(sendApprovalEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'owner@kebunmelon.com',
          locale: 'en',
        })
      );
    });

    it('handles zero active owners gracefully (send not attempted) without erroring', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: true,
        user: {
          id: 'admin-applicant-uuid-999',
          fullName: 'Calon Admin Baru',
          email: 'calon.admin@example.com',
          username: null,
          accountStatus: 'PENDING_APPROVAL' as any,
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: ['ADMIN' as any],
        },
      });

      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      const sendApprovalEmailSpy = vi.spyOn(resendModule, 'sendAdminApprovalRequestEmail');

      const req = new Request('http://localhost/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.27',
        },
        body: JSON.stringify({ token: 'valid-admin-token-no-owners' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(sendApprovalEmailSpy).not.toHaveBeenCalled();
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

    it('successfully consumes 6-digit code with email, marks email verified, returns 200', async () => {
      vi.spyOn(UserRepository.prototype, 'verifyEmailWithToken').mockResolvedValue({
        success: true,
        user: {
          id: '22222222-2222-2222-2222-222222222222',
          fullName: 'Code Verified User',
          email: 'user@example.com',
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
          'x-forwarded-for': '198.51.100.23',
        },
        body: JSON.stringify({ email: 'user@example.com', code: '654321' }),
      });

      const res = await verifyEmailPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('user@example.com');
      expect(json.data.user.emailVerifiedAt).toBeDefined();
    });
  });
});
