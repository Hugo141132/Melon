import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as loginPost } from '../../app/api/v1/auth/login/route';
import { POST as challengePost } from '../../app/api/v1/auth/session-recovery/challenge/route';
import { POST as verifyPost } from '../../app/api/v1/auth/session-recovery/verify/route';
import { clearRateLimitStore } from '../../lib/rate-limit';
import * as resendModule from '../../lib/email/resend';
import {
  ActiveSessionExistsError,
  InvalidCredentialsError,
  NoActiveSessionToRecoverError,
  ExpiredRecoveryOtpError,
  InvalidRecoveryOtpError,
  MaxRecoveryAttemptsExceededError,
  SESSION_COOKIE_NAME,
} from '@kebun-melon/database';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

const mockLoginUser = vi.fn();
const mockCreateSessionRecoveryChallenge = vi.fn();
const mockVerifySessionRecoveryChallenge = vi.fn();

vi.mock('@kebun-melon/database', async () => {
  const actual: any = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    prisma: {},
    loginUser: (...args: any[]) => mockLoginUser(...args),
    createSessionRecoveryChallenge: (...args: any[]) => mockCreateSessionRecoveryChallenge(...args),
    verifySessionRecoveryChallenge: (...args: any[]) => mockVerifySessionRecoveryChallenge(...args),
  };
});

vi.mock('../../lib/email/resend', async () => {
  const actual: any = await vi.importActual('../../lib/email/resend');
  return {
    ...actual,
    sendSessionRecoveryOtpEmail: vi.fn().mockResolvedValue({ success: true, emailSent: true }),
  };
});

describe('TASK-0218 Session Recovery API Routes Test Suite', () => {
  beforeEach(() => {
    clearRateLimitStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login (409 Integration)', () => {
    it('returns HTTP 409 ACTIVE_SESSION_EXISTS with canRecover: true when active session exists', async () => {
      mockLoginUser.mockRejectedValue(new ActiveSessionExistsError());

      const request = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await loginPost(request);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACTIVE_SESSION_EXISTS');
      expect(json.error.canRecover).toBe(true);
    });
  });

  describe('POST /api/v1/auth/session-recovery/challenge', () => {
    it('returns 400 VALIDATION_ERROR on empty or invalid payload', async () => {
      const request = new Request('http://localhost/api/v1/auth/session-recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const response = await challengePost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 INVALID_CREDENTIALS when credentials do not match', async () => {
      mockCreateSessionRecoveryChallenge.mockRejectedValue(new InvalidCredentialsError());

      const request = new Request('http://localhost/api/v1/auth/session-recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'WrongPassword!',
        }),
      });

      const response = await challengePost(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 400 NO_ACTIVE_SESSION when no active session exists to recover', async () => {
      mockCreateSessionRecoveryChallenge.mockRejectedValue(new NoActiveSessionToRecoverError());

      const request = new Request('http://localhost/api/v1/auth/session-recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await challengePost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NO_ACTIVE_SESSION');
    });

    it('returns 200 with challenge metadata and sends recovery OTP email on valid request', async () => {
      const challengeId = '11111111-1111-1111-1111-111111111111';
      const expiresAt = new Date(Date.now() + 60000);

      mockCreateSessionRecoveryChallenge.mockResolvedValue({
        challengeId,
        rawOtp: '654321',
        user: {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'wahyu.santoso@example.com',
          fullName: 'Wahyu Santoso',
        },
        expiresAt,
        expiresInSeconds: 60,
      });

      const request = new Request('http://localhost/api/v1/auth/session-recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'wahyu.santoso@example.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await challengePost(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.challengeId).toBe(challengeId);
      expect(json.data.expiresInSeconds).toBe(60);
      expect(json.data.maskedEmail).toBe('w***o@example.com');
      // Never leak raw OTP in API response
      expect(json.data.rawOtp).toBeUndefined();
      expect(json.data.otp).toBeUndefined();

      expect(resendModule.sendSessionRecoveryOtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'wahyu.santoso@example.com',
          code: '654321',
        })
      );
    });
  });

  describe('POST /api/v1/auth/session-recovery/verify', () => {
    it('returns 400 VALIDATION_ERROR when OTP is not 6 digits', async () => {
      const request = new Request('http://localhost/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: '11111111-1111-1111-1111-111111111111',
          otp: '123', // not 6 digits
        }),
      });

      const response = await verifyPost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 INVALID_OTP with remaining attempts on incorrect code', async () => {
      mockVerifySessionRecoveryChallenge.mockRejectedValue(new InvalidRecoveryOtpError(2));

      const request = new Request('http://localhost/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: '11111111-1111-1111-1111-111111111111',
          otp: '999999',
        }),
      });

      const response = await verifyPost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_OTP');
      expect(json.error.remainingAttempts).toBe(2);
    });

    it('returns 410 OTP_EXPIRED when code validity window has lapsed', async () => {
      mockVerifySessionRecoveryChallenge.mockRejectedValue(new ExpiredRecoveryOtpError());

      const request = new Request('http://localhost/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: '11111111-1111-1111-1111-111111111111',
          otp: '123456',
        }),
      });

      const response = await verifyPost(request);
      const json = await response.json();

      expect(response.status).toBe(410);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('OTP_EXPIRED');
    });

    it('returns 429 MAX_ATTEMPTS_EXCEEDED when challenge has reached 3 failures', async () => {
      mockVerifySessionRecoveryChallenge.mockRejectedValue(new MaxRecoveryAttemptsExceededError());

      const request = new Request('http://localhost/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: '11111111-1111-1111-1111-111111111111',
          otp: '123456',
        }),
      });

      const response = await verifyPost(request);
      const json = await response.json();

      expect(response.status).toBe(429);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    });

    it('returns 200, sets HttpOnly session_token cookie, and returns safe user dto on successful verification', async () => {
      const mockRawToken = 'new-session-raw-token-64-chars-long-0123456789abcdef0123456789abcdef';
      const mockUser = {
        id: '11111111-1111-1111-1111-111111111111',
        fullName: 'Wahyu Santoso',
        email: 'wahyu@example.com',
        role: UserRole.ADMIN,
        activeRoles: [UserRole.ADMIN],
        accountStatus: AccountStatus.ACTIVE,
      };

      mockVerifySessionRecoveryChallenge.mockResolvedValue({
        rawToken: mockRawToken,
        user: mockUser,
      });

      const request = new Request('http://localhost/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 TestBrowser',
          'X-Forwarded-For': '203.0.113.195',
        },
        body: JSON.stringify({
          challengeId: '11111111-1111-1111-1111-111111111111',
          otp: '123456',
        }),
      });

      const response = await verifyPost(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.user.id).toBe(mockUser.id);
      expect(json.data.user.email).toBe(mockUser.email);

      // Verify HttpOnly cookie
      const cookieHeader = response.headers.get('set-cookie');
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=${mockRawToken}`);
      expect(cookieHeader?.toLowerCase()).toContain('httponly');
      expect(cookieHeader?.toLowerCase()).toContain('samesite=strict');
    });
  });
});
