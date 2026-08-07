import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as pendingApprovalsHandler } from '../../app/api/v1/approvals/pending/route';
import { POST as approveUserHandler } from '../../app/api/v1/approvals/[userId]/approve/route';
import { POST as rejectUserHandler } from '../../app/api/v1/approvals/[userId]/reject/route';
import { GET as listUsersHandler } from '../../app/api/v1/users/route';
import { PATCH as updateUserHandler } from '../../app/api/v1/users/[userId]/route';
import { POST as assignDeviceHandler } from '../../app/api/v1/users/[userId]/devices/route';
import { GET as auditLogsHandler } from '../../app/api/v1/audit-logs/route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';
import { NextRequest } from 'next/server';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockValidateSession = vi.fn();
const mockGetPendingApprovals = vi.fn();
const mockApprovePendingAdmin = vi.fn();
const mockRejectPendingAdmin = vi.fn();
const mockGetUsers = vi.fn();
const mockUpdateOtherUserProfile = vi.fn();
const mockAssignDeviceToUser = vi.fn();
const mockFindAuditLogs = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    validateSession: (...args: any[]) => mockValidateSession(...args),
    UserRepository: class {
      getPendingApprovals(...args: any[]) {
        return mockGetPendingApprovals(...args);
      }
      approvePendingAdmin(...args: any[]) {
        return mockApprovePendingAdmin(...args);
      }
      rejectPendingAdmin(...args: any[]) {
        return mockRejectPendingAdmin(...args);
      }
      getUsers(...args: any[]) {
        return mockGetUsers(...args);
      }
      updateOtherUserProfile(...args: any[]) {
        return mockUpdateOtherUserProfile(...args);
      }
    },
    DeviceAssignmentRepository: class {
      assignDeviceToUser(...args: any[]) {
        return mockAssignDeviceToUser(...args);
      }
    },
    AuditRepository: {
      findAuditLogs: (...args: any[]) => mockFindAuditLogs(...args),
    },
  };
});

describe('API Integration Test Suite — RBAC Matrix & Role Boundaries (TASK-1002)', () => {
  const mockAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Active Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockOwnerUser = {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Active Owner',
    email: 'owner@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  const mockPendingUserId = '55555555-5555-4555-8555-555555555555';
  const mockTargetDeviceId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';

    mockGetPendingApprovals.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    mockGetUsers.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    mockFindAuditLogs.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    });
  });

  describe('1. Negative Security Tests — Admin Privileges Restricted', () => {
    beforeEach(() => {
      mockValidateSession.mockResolvedValue({ user: mockAdminUser });
    });

    it('denies Admin access to GET /api/v1/approvals/pending with 403 FORBIDDEN_ROLE', async () => {
      const req = new Request('http://localhost:3000/api/v1/approvals/pending');
      const res = await pendingApprovalsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('denies Admin access to POST /api/v1/approvals/[userId]/approve with 403 FORBIDDEN_ROLE', async () => {
      const req = new Request(
        `http://localhost:3000/api/v1/approvals/${mockPendingUserId}/approve`,
        {
          method: 'POST',
        }
      );
      const res = await approveUserHandler(req, {
        params: Promise.resolve({ userId: mockPendingUserId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('denies Admin access to POST /api/v1/approvals/[userId]/reject with 403 FORBIDDEN_ROLE', async () => {
      const req = new Request(
        `http://localhost:3000/api/v1/approvals/${mockPendingUserId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Incomplete information' }),
        }
      );
      const res = await rejectUserHandler(req, {
        params: Promise.resolve({ userId: mockPendingUserId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('denies Admin access to GET /api/v1/users with 403 INSUFFICIENT_PERMISSION', async () => {
      const req = new Request('http://localhost:3000/api/v1/users');
      const res = await listUsersHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('denies Admin access to PATCH /api/v1/users/[userId] with 403 INSUFFICIENT_PERMISSION', async () => {
      const req = new Request(`http://localhost:3000/api/v1/users/${mockPendingUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Tampered Name' }),
      });
      const res = await updateUserHandler(req, {
        params: Promise.resolve({ userId: mockPendingUserId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('denies Admin self-role elevation attempts with 403 INSUFFICIENT_PERMISSION', async () => {
      const req = new Request(`http://localhost:3000/api/v1/users/${mockAdminUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'OWNER' }),
      });
      const res = await updateUserHandler(req, {
        params: Promise.resolve({ userId: mockAdminUser.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('denies Admin device assignment access with 403 INSUFFICIENT_PERMISSION', async () => {
      const req = new Request(`http://localhost:3000/api/v1/users/${mockAdminUser.id}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: mockTargetDeviceId }),
      });
      const res = await assignDeviceHandler(req, {
        params: Promise.resolve({ userId: mockAdminUser.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('denies Admin audit log access with 403 INSUFFICIENT_PERMISSION', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/audit-logs');
      const res = await auditLogsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('2. Positive Owner Capability Tests', () => {
    beforeEach(() => {
      mockValidateSession.mockResolvedValue({ user: mockOwnerUser });
    });

    it('allows Owner to GET /api/v1/approvals/pending', async () => {
      mockGetPendingApprovals.mockResolvedValueOnce({
        items: [
          {
            id: mockPendingUserId,
            fullName: 'Pending Candidate',
            email: 'candidate@kebunmelon.id',
            accountStatus: AccountStatus.PENDING_APPROVAL,
            createdAt: new Date(),
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const req = new Request('http://localhost:3000/api/v1/approvals/pending');
      const res = await pendingApprovalsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });

    it('allows Owner to approve pending registration via POST /api/v1/approvals/[userId]/approve', async () => {
      mockApprovePendingAdmin.mockResolvedValueOnce({
        success: true,
        user: {
          id: mockPendingUserId,
          accountStatus: AccountStatus.ACTIVE,
          approvedAt: new Date(),
          approvedByUserId: mockOwnerUser.id,
        },
      });

      const req = new Request(
        `http://localhost:3000/api/v1/approvals/${mockPendingUserId}/approve`,
        {
          method: 'POST',
        }
      );
      const res = await approveUserHandler(req, {
        params: Promise.resolve({ userId: mockPendingUserId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.user.accountStatus).toBe('ACTIVE');
    });

    it('allows Owner to view audit logs via GET /api/v1/audit-logs', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({
        items: [
          {
            id: 'audit-001',
            eventKey: 'user.approved',
            actorUserId: mockOwnerUser.id,
            actorRole: UserRole.OWNER,
            targetResourceId: mockPendingUserId,
            timestamp: new Date(),
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/audit-logs');
      const res = await auditLogsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });
  });
});
