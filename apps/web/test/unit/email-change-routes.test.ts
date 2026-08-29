import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as requestEmailChangePost } from '../../app/api/v1/me/email/request/route';
import { POST as verifyEmailChangePost } from '../../app/api/v1/me/email/verify/route';
import * as rbacModule from '../../lib/auth/rbac';
import { clearRateLimitStore } from '../../lib/rate-limit';
import * as resendModule from '../../lib/email/resend';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

vi.mock('../../lib/auth/rbac', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireSession: vi.fn(),
    requireActiveAccount: vi.fn(),
    requirePermission: vi.fn(),
  };
});

const mockRequestEmailChange = vi.fn();
const mockVerifyEmailChange = vi.fn();

vi.mock('@kebun-melon/database', async () => {
  const actual: any = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    prisma: {},
    UserRepository: class {
      requestEmailChange = mockRequestEmailChange;
      verifyEmailChange = mockVerifyEmailChange;
    },
  };
});

describe('TASK-0216 Email Change API Routes Test Suite', () => {
  const mockUserSession: rbacModule.AuthenticatedUserSession = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    fullName: 'Active Admin User',
    email: 'current.admin@example.com',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  beforeEach(() => {
    clearRateLimitStore();
    vi.clearAllMocks();
    vi.mocked(rbacModule.requireSession).mockResolvedValue(mockUserSession);
    vi.mocked(rbacModule.requireActiveAccount).mockReturnValue(mockUserSession);
    vi.mocked(rbacModule.requirePermission).mockReturnValue(mockUserSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/me/email/request', () => {
    it('returns 401 when request is unauthenticated', async () => {
      vi.mocked(rbacModule.requireSession).mockRejectedValue(
        new rbacModule.AuthorizationError(401, 'UNAUTHENTICATED', 'Authentication required')
      );

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'Password123!', newEmail: 'new@example.com' }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 when user account is inactive', async () => {
      vi.mocked(rbacModule.requireActiveAccount).mockImplementation(() => {
        throw new rbacModule.AuthorizationError(403, 'FORBIDDEN', 'Account is not active');
      });

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'Password123!', newEmail: 'new@example.com' }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('enforces canonical permission profilee.self.update', async () => {
      mockRequestEmailChange.mockResolvedValue({
        success: true,
        code: '123456',
        pendingEmail: 'new@example.com',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        user: mockUserSession,
      });
      vi.spyOn(resendModule, 'sendEmailChangeVerificationEmail').mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'Password123!', newEmail: 'new@example.com' }),
      });

      await requestEmailChangePost(req);
      expect(rbacModule.requirePermission).toHaveBeenCalledWith(
        mockUserSession,
        'profilee.self.update',
        'USER',
        mockUserSession.id,
        expect.anything()
      );
    });

    it('returns 422 when required currentPassword or newEmail is missing or invalid', async () => {
      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newEmail: 'invalid-email' }), // Missing currentPassword & bad email
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 INVALID_CREDENTIALS when current password is wrong', async () => {
      mockRequestEmailChange.mockResolvedValue({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect.',
      });

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'WrongPassword!', newEmail: 'new@example.com' }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 400 SAME_EMAIL when new email is identical to current email', async () => {
      mockRequestEmailChange.mockResolvedValue({
        success: false,
        error: 'SAME_EMAIL',
        message: 'New email cannot be identical to current email.',
      });

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'Password123!',
          newEmail: 'current.admin@example.com',
        }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SAME_EMAIL');
    });

    it('returns 409 DUPLICATE_EMAIL when candidate email is already taken or pending', async () => {
      mockRequestEmailChange.mockResolvedValue({
        success: false,
        error: 'DUPLICATE_EMAIL',
        message: 'Email is already in use by another account.',
      });

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'Password123!', newEmail: 'taken@example.com' }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DUPLICATE_EMAIL');
    });

    it('rate limiting: enforces 3 requests per minute threshold', async () => {
      mockRequestEmailChange.mockResolvedValue({
        success: true,
        code: '123456',
        pendingEmail: 'new@example.com',
        expiresAt: new Date(),
        user: mockUserSession,
      });
      vi.spyOn(resendModule, 'sendEmailChangeVerificationEmail').mockResolvedValue({} as any);

      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const req = new Request('http://localhost/api/v1/me/email/request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'Password123!',
            newEmail: `new${i}@example.com`,
          }),
        });
        const res = await requestEmailChangePost(req);
        expect(res.status).toBe(200);
      }

      // 4th request exceeds rate limit -> 429
      const reqBlocked = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'Password123!', newEmail: 'blocked@example.com' }),
      });
      const resBlocked = await requestEmailChangePost(reqBlocked);
      expect(resBlocked.status).toBe(429);
      const json = await resBlocked.json();
      expect(json.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('returns 200 with VERIFICATION_CODE_SENT and sends verification email on success', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      mockRequestEmailChange.mockResolvedValue({
        success: true,
        code: '654321',
        pendingEmail: 'new.verified@example.com',
        expiresAt,
        user: mockUserSession,
      });
      const sendEmailSpy = vi
        .spyOn(resendModule, 'sendEmailChangeVerificationEmail')
        .mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'Password123!',
          newEmail: 'new.verified@example.com',
        }),
      });

      const res = await requestEmailChangePost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('VERIFICATION_CODE_SENT');
      expect(json.data.expiresAt).toBe(expiresAt.toISOString());

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'new.verified@example.com',
          code: '654321',
        })
      );
    });
  });

  describe('POST /api/v1/me/email/verify', () => {
    it('returns 422 when code is missing or empty', async () => {
      const req = new Request('http://localhost/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '' }), // Empty code
      });

      const res = await verifyEmailChangePost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 INVALID_VERIFICATION_CODE when code is wrong', async () => {
      mockVerifyEmailChange.mockResolvedValue({
        success: false,
        error: 'INVALID_VERIFICATION_CODE',
        message: 'Invalid verification code.',
      });

      const req = new Request('http://localhost/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '000000' }),
      });

      const res = await verifyEmailChangePost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('returns 409 CONCURRENCY_CONFLICT when retry limit is exhausted', async () => {
      mockVerifyEmailChange.mockResolvedValue({
        success: false,
        error: 'CONCURRENCY_CONFLICT',
        message: 'Concurrent verification in progress. Please try again.',
      });

      const req = new Request('http://localhost/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });

      const res = await verifyEmailChangePost(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONCURRENCY_CONFLICT');
    });

    it('rate limiting: enforces 5 requests per minute threshold', async () => {
      mockVerifyEmailChange.mockResolvedValue({
        success: false,
        error: 'INVALID_VERIFICATION_CODE',
        message: 'Invalid verification code.',
      });

      // 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost/api/v1/me/email/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: '123456' }),
        });
        const res = await verifyEmailChangePost(req);
        expect(res.status).toBe(400);
      }

      // 6th attempt -> 429
      const reqBlocked = new Request('http://localhost/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });
      const resBlocked = await verifyEmailChangePost(reqBlocked);
      expect(resBlocked.status).toBe(429);
      const json = await resBlocked.json();
      expect(json.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('returns 200 with updated email and emailVerifiedAt on successful verification', async () => {
      const emailVerifiedAt = new Date();
      mockVerifyEmailChange.mockResolvedValue({
        success: true,
        email: 'promoted.new@example.com',
        emailVerifiedAt,
        user: { ...mockUserSession, email: 'promoted.new@example.com' },
      });

      const req = new Request('http://localhost/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '654321' }),
      });

      const res = await verifyEmailChangePost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe('promoted.new@example.com');
      expect(json.data.emailVerifiedAt).toBe(emailVerifiedAt.toISOString());
    });
  });
});
