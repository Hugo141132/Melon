import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as registerHandler } from '../../app/api/v1/auth/register/route';
import { POST as loginHandler } from '../../app/api/v1/auth/login/route';
import { POST as logoutHandler } from '../../app/api/v1/auth/logout/route';
import { POST as changePasswordHandler } from '../../app/api/v1/auth/change-password/route';
import { GET as sessionHandler } from '../../app/api/v1/auth/session/route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = undefined;

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockRegisterUser = vi.fn();
const mockLoginUser = vi.fn();
const mockLogoutUser = vi.fn();
const mockValidateSession = vi.fn();
const mockChangeUserPassword = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    registerUser: (...args: any[]) => mockRegisterUser(...args),
    loginUser: (...args: any[]) => mockLoginUser(...args),
    revokeSession: (...args: any[]) => mockLogoutUser(...args),
    validateSession: (...args: any[]) => mockValidateSession(...args),
    UserRepository: class {
      changeUserPassword(...args: any[]) {
        return mockChangeUserPassword(...args);
      }
      createEmailVerificationToken() {
        return Promise.resolve({ success: true, rawToken: 'mock-verification-token' });
      }
    },
  };
});

describe('API Integration Test Suite — Authentication Matrix (TASK-1002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = undefined;
  });

  describe('1. Public Admin Registration Matrix (POST /api/v1/auth/register)', () => {
    it('creates an ADMIN user with accountStatus PENDING_APPROVAL on valid input', async () => {
      const mockUser = {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'New Admin Candidate',
        email: 'candidate@kebunmelon.id',
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

      mockRegisterUser.mockResolvedValueOnce({ user: mockUser });

      const req = new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'New Admin Candidate',
          email: 'candidate@kebunmelon.id',
          password: 'ValidPassword123!',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.user.activeRoles).toContain('ADMIN');
      expect(json.data.user.accountStatus).toBe('PENDING_APPROVAL');
      expect(json.data.user.email).toBe('candidate@kebunmelon.id');
    });

    it('rejects public registration attempts requesting the OWNER role', async () => {
      mockRegisterUser.mockRejectedValueOnce(new dbModule.OwnerAlreadyExistsError());

      const req = new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Malicious User',
          email: 'hacker@kebunmelon.id',
          password: 'ValidPassword123!',
          role: 'OWNER',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('OWNER_ALREADY_EXISTS');
    });

    it('returns 422 Unprocessable Entity validation error on weak password', async () => {
      mockRegisterUser.mockRejectedValueOnce(
        new dbModule.PasswordPolicyError('Password does not meet minimum complexity requirements.')
      );

      const req = new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Weak User',
          email: 'weak@kebunmelon.id',
          password: '123',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('PASSWORD_POLICY_FAILED');
    });

    it('returns 409 Conflict when registering an existing email', async () => {
      mockRegisterUser.mockRejectedValueOnce(
        new dbModule.DuplicateEmailError('Email candidate@kebunmelon.id is already registered.')
      );

      const req = new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Duplicate User',
          email: 'candidate@kebunmelon.id',
          password: 'ValidPassword123!',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('2. User Login Matrix (POST /api/v1/auth/login)', () => {
    it('allows ACTIVE accounts to log in and sets secure HTTP-only cookie', async () => {
      const mockActiveAdmin = {
        rawToken: 'valid-session-token-999',
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          fullName: 'Active Admin',
          email: 'admin@kebunmelon.id',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.ADMIN],
        },
      };

      mockLoginUser.mockResolvedValueOnce(mockActiveAdmin as any);

      const req = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@kebunmelon.id',
          password: 'ValidPassword123!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('ADMIN');
      expect(json.data.user.accountStatus).toBe('ACTIVE');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=valid-session-token-999');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie?.toLowerCase()).toContain('samesite=strict');
    });

    it('denies login with 403 Forbidden for PENDING_APPROVAL accounts', async () => {
      mockLoginUser.mockRejectedValueOnce(
        new dbModule.AccountStatusForbiddenError(AccountStatus.PENDING_APPROVAL)
      );

      const req = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'pending@kebunmelon.id',
          password: 'ValidPassword123!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
    });

    it('denies login with 403 Forbidden for SUSPENDED accounts', async () => {
      mockLoginUser.mockRejectedValueOnce(
        new dbModule.AccountStatusForbiddenError(AccountStatus.SUSPENDED)
      );

      const req = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'suspended@kebunmelon.id',
          password: 'ValidPassword123!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('returns 401 Unauthorized for invalid password', async () => {
      mockLoginUser.mockRejectedValueOnce(new dbModule.InvalidCredentialsError());

      const req = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@kebunmelon.id',
          password: 'WrongPassword!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('3. Logout Matrix (POST /api/v1/auth/logout)', () => {
    it('returns 204 No Content and clears session cookie even when session token cookie is missing', async () => {
      mockCookieToken = undefined;

      const req = new Request('http://localhost:3000/api/v1/auth/logout', {
        method: 'POST',
      });

      const res = await logoutHandler(req);

      expect(res.status).toBe(204);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('invalidates session token and clears session cookie for active session', async () => {
      mockCookieToken = 'valid-token';
      mockLogoutUser.mockResolvedValueOnce(true);

      const req = new Request('http://localhost:3000/api/v1/auth/logout', {
        method: 'POST',
        headers: { Cookie: 'session_token=valid-token' },
      });

      const res = await logoutHandler(req);

      expect(res.status).toBe(204);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  describe('4. Session Status & Revocation Matrix', () => {
    it('returns authenticated: false on /api/v1/auth/session when token is invalid or revoked', async () => {
      mockCookieToken = 'revoked-token';
      mockValidateSession.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/v1/auth/session', {
        method: 'GET',
        headers: { Cookie: 'session_token=revoked-token' },
      });

      const res = await sessionHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.authenticated).toBe(false);
      expect(json.data.user).toBeNull();
    });

    it('returns active user session on /api/v1/auth/session for valid token', async () => {
      mockCookieToken = 'active-token';
      mockValidateSession.mockResolvedValueOnce({
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'admin@kebunmelon.id',
          fullName: 'Active Admin',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/auth/session', {
        method: 'GET',
        headers: { Cookie: 'session_token=active-token' },
      });

      const res = await sessionHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.authenticated).toBe(true);
      expect(json.data.user.email).toBe('admin@kebunmelon.id');
      expect(json.data.user.accountStatus).toBe('ACTIVE');
    });

    it('revokes all sessions on POST /api/v1/auth/change-password and returns 204 No Content', async () => {
      mockCookieToken = 'active-token';
      mockValidateSession.mockResolvedValueOnce({
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'admin@kebunmelon.id',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.ADMIN],
        },
      });
      mockChangeUserPassword.mockResolvedValueOnce({ success: true, revokedSessionCount: 3 });

      const req = new Request('http://localhost:3000/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'session_token=active-token' },
        body: JSON.stringify({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewStrongPassword123!',
        }),
      });

      const res = await changePasswordHandler(req);

      expect(res.status).toBe(204);
      expect(mockChangeUserPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '22222222-2222-4222-8222-222222222222',
          currentPassword: 'OldPassword123!',
          newPassword: 'NewStrongPassword123!',
        })
      );
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});
