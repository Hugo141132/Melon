import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PATCH } from '../route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

const mockFindUserById = vi.fn();
const mockUpdateUserProfile = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    UserRepository: class {
      findUserById(...args: any[]) {
        return mockFindUserById(...args);
      }
      updateUserProfile(...args: any[]) {
        return mockUpdateUserProfile(...args);
      }
    },
  };
});

describe('TASK-0211 Self Profile API Routes GET & PATCH /api/v1/me', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
  });

  describe('GET /api/v1/me', () => {
    it('1. Unauthenticated GET /me returns 401 UNAUTHENTICATED', async () => {
      mockCookieToken = undefined;
      const req = new Request('http://localhost:3000/api/v1/me');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('2. ACTIVE OWNER GET /me returns own profile without sensitive fields', async () => {
      mockCookieToken = 'owner-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-owner',
          userId: 'owner-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'owner-id-1',
          fullName: 'Owner User',
          email: 'owner@test.com',
          username: 'owner1',
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.OWNER],
        },
      });

      mockFindUserById.mockResolvedValueOnce({
        id: 'owner-id-1',
        fullName: 'Owner User',
        email: 'owner@test.com',
        username: 'owner1',
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-27T12:00:00Z'),
        activeRoles: [UserRole.OWNER],
      });

      const req = new Request('http://localhost:3000/api/v1/me');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('owner-id-1');
      expect(json.data.fullName).toBe('Owner User');
      expect(json.data).not.toHaveProperty('passwordHash');
      expect(json.data).not.toHaveProperty('sessionTokenHash');
    });

    it('3. ACTIVE ADMIN GET /me returns own profile without sensitive fields', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      mockFindUserById.mockResolvedValueOnce({
        id: 'admin-id-1',
        fullName: 'Admin User',
        email: 'admin@test.com',
        username: null,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-27T12:00:00Z'),
        activeRoles: [UserRole.ADMIN],
      });

      const req = new Request('http://localhost:3000/api/v1/me');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('admin-id-1');
      expect(json.data.fullName).toBe('Admin User');
      expect(json.data).not.toHaveProperty('passwordHash');
    });

    it('11. Inactive account (PENDING_APPROVAL / SUSPENDED) cannot use GET /me (returns 403)', async () => {
      mockCookieToken = 'pending-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-pending',
          userId: 'pending-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'pending-id-1',
          fullName: 'Pending User',
          email: 'pending@test.com',
          username: null,
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });
  });

  describe('PATCH /api/v1/me', () => {
    it('5. PATCH of allowed self-profile field succeeds', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      mockUpdateUserProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'admin-id-1',
          fullName: 'Updated Admin Name',
          email: 'admin@test.com',
          username: 'newusername',
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date('2026-07-20T10:00:00Z'),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Updated Admin Name', username: 'newusername' }),
      });

      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.fullName).toBe('Updated Admin Name');
      expect(mockUpdateUserProfile).toHaveBeenCalledWith({
        userId: 'admin-id-1',
        data: { fullName: 'Updated Admin Name', username: 'newusername' },
        requestId: expect.any(String),
        ipAddress: undefined,
        userAgent: undefined,
      });
    });

    it('6. PATCH applies ONLY to authenticated user (derives target exclusively from session)', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      mockUpdateUserProfile.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'admin-id-1',
          fullName: 'Name Change',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date('2026-07-20T10:00:00Z'),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Name Change' }),
      });

      await PATCH(req);

      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-id-1',
        })
      );
    });

    it('7. Attempted role injection fails validation (422)', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'OWNER', fullName: 'Hacker' }),
      });

      const res = await PATCH(req);

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('8. Attempted accountStatus injection fails validation (422)', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: 'ACTIVE' }),
      });

      const res = await PATCH(req);

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('9. Attempted user ID injection fails validation (422)', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'other-user-uuid', fullName: 'Hacker' }),
      });

      const res = await PATCH(req);

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('10. Unknown/unallowlisted fields fail strict validation (422)', async () => {
      mockCookieToken = 'admin-token';

      vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
        session: {
          id: 's-admin',
          userId: 'admin-id-1',
          expiresAt: new Date(),
          lastSeenAt: new Date(),
        },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          username: null,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeRoles: [UserRole.ADMIN],
        },
      });

      const req = new Request('http://localhost:3000/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Valid', unknownField: 'hacked' }),
      });

      const res = await PATCH(req);

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
