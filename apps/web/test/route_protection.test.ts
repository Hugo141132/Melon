import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';
import {
  requireSession,
  requireRole,
  requireActiveAccount,
  AuthorizationError,
  AuthenticatedUserSession,
} from '../lib/auth/rbac';

const mockValidateSession = vi.fn();

vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  SESSION_COOKIE_NAME: 'session_token',
  validateSession: (...args: any[]) => mockValidateSession(...args),
}));

describe('TASK-0210 — Route and API Protection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Next.js Middleware Protection Checks', () => {
    it('1. Allows public auth, health, and readiness routes without session cookie', () => {
      const publicPaths = [
        '/login',
        '/register',
        '/status',
        '/health',
        '/ready',
        '/api/v1/auth/login',
      ];
      for (const path of publicPaths) {
        const req = new NextRequest(`http://localhost:3000${path}`);
        const res = middleware(req);
        expect(res.headers.get('x-middleware-rewrite') || res.status).not.toBe(401);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    it('1b. Allows public /health and /ready without redirecting to /login', () => {
      const healthReq = new NextRequest('http://localhost:3000/health');
      const healthRes = middleware(healthReq);
      expect(healthRes.status).toBe(200); // NextResponse.next()
      expect(healthRes.headers.get('location')).toBeNull();

      const readyReq = new NextRequest('http://localhost:3000/ready');
      const readyRes = middleware(readyReq);
      expect(readyRes.status).toBe(200); // NextResponse.next()
      expect(readyRes.headers.get('location')).toBeNull();
    });

    it('2. Redirects unauthenticated page request to /login with redirect query param', () => {
      const req = new NextRequest('http://localhost:3000/tanah');
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?redirect=%2Ftanah');
    });

    it('3. Returns 401 UNAUTHENTICATED JSON for unauthenticated protected API request', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/approvals/pending');
      const res = middleware(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('4. Allows protected page request to proceed when session cookie is present', () => {
      const req = new NextRequest('http://localhost:3000/air', {
        headers: { cookie: 'session_token=valid-token-xyz' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200); // NextResponse.next()
    });

    it('5. Allows device telemetry ingestion API endpoints without user session cookie', () => {
      const telemetryEndpoint = 'http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil';
      const req = new NextRequest(telemetryEndpoint, {
        method: 'POST',
        headers: { 'x-device-id': 'soil-node-001' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200); // NextResponse.next() -> allows request to proceed to route handler
      expect(res.headers.get('location')).toBeNull();
    });

    it('6. Allows public auth routes to pass through middleware without redirect loops', () => {
      const guestPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      for (const path of guestPaths) {
        const req = new NextRequest(`http://localhost:3000${path}`, {
          headers: { cookie: 'session_token=some-token-xyz' },
        });
        const res = middleware(req);
        expect(res.status).toBe(200); // NextResponse.next()
        expect(res.headers.get('location')).toBeNull();
      }
    });
  });

  describe('Server-Side Session & RBAC Enforcement Helpers', () => {
    const activeOwnerSession: AuthenticatedUserSession = {
      id: 'owner-uuid-1',
      fullName: 'Owner User',
      email: 'owner@kebunmelon.id',
      accountStatus: AccountStatus.ACTIVE,
      activeRoles: [UserRole.OWNER],
    };

    const activeAdminSession: AuthenticatedUserSession = {
      id: 'admin-uuid-1',
      fullName: 'Admin User',
      email: 'admin@kebunmelon.id',
      accountStatus: AccountStatus.ACTIVE,
      activeRoles: [UserRole.ADMIN],
    };

    const pendingAdminSession: AuthenticatedUserSession = {
      id: 'pending-uuid-1',
      fullName: 'Pending User',
      email: 'pending@kebunmelon.id',
      accountStatus: AccountStatus.PENDING_APPROVAL,
      activeRoles: [UserRole.ADMIN],
    };

    const suspendedAdminSession: AuthenticatedUserSession = {
      id: 'suspended-uuid-1',
      fullName: 'Suspended User',
      email: 'suspended@kebunmelon.id',
      accountStatus: AccountStatus.SUSPENDED,
      activeRoles: [UserRole.ADMIN],
    };

    it('5. Unauthenticated request without token throws 401 UNAUTHENTICATED', async () => {
      const req = new Request('http://localhost:3000/api/v1/approvals/pending');
      await expect(requireSession(req)).rejects.toThrow(AuthorizationError);
      try {
        await requireSession(req);
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHENTICATED');
      }
    });

    it('6. Invalid or expired token throws 401 INVALID_SESSION', async () => {
      mockValidateSession.mockResolvedValueOnce(null);
      const req = new Request('http://localhost:3000/api/v1/approvals/pending', {
        headers: { cookie: 'session_token=expired-invalid-token' },
      });
      await expect(requireSession(req)).rejects.toThrow(AuthorizationError);
      try {
        await requireSession(req);
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('INVALID_SESSION');
      }
    });

    it('7. Inactive accounts (PENDING_APPROVAL, SUSPENDED) fail requireActiveAccount check with 403', () => {
      expect(() => requireActiveAccount(pendingAdminSession)).toThrow(AuthorizationError);
      expect(() => requireActiveAccount(suspendedAdminSession)).toThrow(AuthorizationError);
      try {
        requireActiveAccount(pendingAdminSession);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('ACCOUNT_NOT_ACTIVE');
      }
    });

    it('8. ACTIVE Owner passes Owner-only route guard (requireRole OWNER)', () => {
      expect(() => requireRole(activeOwnerSession, UserRole.OWNER)).not.toThrow();
    });

    it('9. ACTIVE Admin fails Owner-only route guard (requireRole OWNER) with 403 FORBIDDEN_ROLE', () => {
      expect(() => requireRole(activeAdminSession, UserRole.OWNER)).toThrow(AuthorizationError);
      try {
        requireRole(activeAdminSession, UserRole.OWNER);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('10. Direct URL/API access attempt by Admin to Owner endpoint fails server-side RBAC', async () => {
      mockValidateSession.mockResolvedValueOnce({
        session: { id: 's-admin', userId: 'admin-uuid-1' },
        user: {
          id: 'admin-uuid-1',
          fullName: 'Admin User',
          email: 'admin@kebunmelon.id',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/approvals/pending', {
        headers: { cookie: 'session_token=admin-token' },
      });

      const session = await requireSession(req);
      expect(session.activeRoles).toContain(UserRole.ADMIN);
      expect(() => requireRole(session, UserRole.OWNER)).toThrow(AuthorizationError);
    });
  });
});
