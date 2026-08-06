import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as pendingGET } from '../pending/route';
import { GET as detailGET } from '../[userId]/route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

let mockCookieToken: string | undefined = 'valid-owner-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

const mockValidateSession = vi.fn();
const mockReadActiveRoleAssignments = vi.fn();
const mockGetPendingApprovals = vi.fn();
const mockGetPendingApprovalById = vi.fn();

vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  SESSION_COOKIE_NAME: 'session_token',
  validateSession: (...args: any[]) => mockValidateSession(...args),
  UserRepository: vi.fn().mockImplementation(function () {
    return {
      readActiveRoleAssignments: (...args: any[]) => mockReadActiveRoleAssignments(...args),
      getPendingApprovals: (...args: any[]) => mockGetPendingApprovals(...args),
      getPendingApprovalById: (...args: any[]) => mockGetPendingApprovalById(...args),
    };
  }),
}));

describe('TASK-0206 Owner Pending Approval API Routes Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-owner-token';
  });

  describe('GET /api/v1/approvals/pending', () => {
    it('returns 401 UNAUTHENTICATED if session token is missing', async () => {
      mockCookieToken = undefined;

      const req = new Request('http://localhost:3000/api/v1/approvals/pending', {
        headers: {},
      });

      const res = await pendingGET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 FORBIDDEN if user is authenticated active ADMIN but not OWNER', async () => {
      mockCookieToken = 'valid-admin-token';

      mockValidateSession.mockResolvedValueOnce({
        session: { id: 's1', userId: 'admin-id-1' },
        user: {
          id: 'admin-id-1',
          fullName: 'Admin User',
          email: 'admin@test.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.ADMIN],
        },
      });

      mockReadActiveRoleAssignments.mockResolvedValue([UserRole.ADMIN]);

      const req = new Request('http://localhost:3000/api/v1/approvals/pending');
      const res = await pendingGET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('returns 401 UNAUTHENTICATED when session revalidation fails due to inactive account status', async () => {
      mockCookieToken = 'suspended-owner-token';

      // validateSession soft-revokes and returns null when account status is not ACTIVE
      mockValidateSession.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/v1/approvals/pending');
      const res = await pendingGET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_SESSION');
    });

    it('returns 200 OK with safe allowlisted data envelope for active OWNER', async () => {
      mockCookieToken = 'valid-owner-token';

      mockValidateSession.mockResolvedValueOnce({
        session: { id: 's2', userId: 'owner-id-1' },
        user: {
          id: 'owner-id-1',
          fullName: 'Owner User',
          email: 'owner@test.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.OWNER],
        },
      });

      mockReadActiveRoleAssignments.mockResolvedValue([UserRole.OWNER]);

      mockReadActiveRoleAssignments.mockResolvedValueOnce([UserRole.OWNER]);

      const mockItems = [
        {
          userId: 'b0336ca1-0000-0000-0000-000000000000',
          fullName: 'Pending Applicant 1',
          email: 'pending1@example.com',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          createdAt: new Date('2026-07-28T10:00:00Z'),
        },
      ];

      mockGetPendingApprovals.mockResolvedValueOnce({
        items: mockItems,
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const req = new Request('http://localhost:3000/api/v1/approvals/pending?page=1&pageSize=20');
      const res = await pendingGET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].fullName).toBe('Pending Applicant 1');
      expect(json.data[0]).not.toHaveProperty('passwordHash');
      expect(json.data[0]).not.toHaveProperty('sessionTokenHash');
      expect(json.meta.pagination.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/approvals/[userId]', () => {
    it('returns 404 USER_NOT_FOUND if pending applicant does not exist or is not PENDING_APPROVAL', async () => {
      mockCookieToken = 'valid-owner-token';

      mockValidateSession.mockResolvedValueOnce({
        session: { id: 's2', userId: 'owner-id-1' },
        user: {
          id: 'owner-id-1',
          fullName: 'Owner User',
          email: 'owner@test.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.OWNER],
        },
      });

      mockReadActiveRoleAssignments.mockResolvedValueOnce([UserRole.OWNER]);
      mockGetPendingApprovalById.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/v1/approvals/non-existent-user-id');
      const res = await detailGET(req, {
        params: Promise.resolve({ userId: 'non-existent-user-id' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns 200 OK with single pending registration detail for active OWNER', async () => {
      mockCookieToken = 'valid-owner-token';

      mockValidateSession.mockResolvedValueOnce({
        session: { id: 's2', userId: 'owner-id-1' },
        user: {
          id: 'owner-id-1',
          fullName: 'Owner User',
          email: 'owner@test.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.OWNER],
        },
      });

      mockReadActiveRoleAssignments.mockResolvedValueOnce([UserRole.OWNER]);

      const mockDetail = {
        userId: 'applicant-uuid-99',
        fullName: 'Pending Detail Admin',
        email: 'pending99@example.com',
        accountStatus: AccountStatus.PENDING_APPROVAL,
        createdAt: new Date('2026-07-28T12:00:00Z'),
      };

      mockGetPendingApprovalById.mockResolvedValueOnce(mockDetail);

      const req = new Request('http://localhost:3000/api/v1/approvals/applicant-uuid-99');
      const res = await detailGET(req, {
        params: Promise.resolve({ userId: 'applicant-uuid-99' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.userId).toBe('applicant-uuid-99');
      expect(json.data.fullName).toBe('Pending Detail Admin');
    });
  });
});
