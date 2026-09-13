import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as bulkDeleteRoute } from '../../app/api/v1/users/bulk-delete/route';
import { POST as suspendUserRoute } from '../../app/api/v1/users/[userId]/suspend/route';
import { POST as activateUserRoute } from '../../app/api/v1/users/[userId]/activate/route';
import { DELETE as deleteUserRoute } from '../../app/api/v1/users/[userId]/route';
import * as rbacModule from '../../lib/auth/rbac';
import { UserRole } from '@kebun-melon/contracts';
import { NextRequest } from 'next/server';

const {
  mockBulkDeleteUsers,
  mockSuspendUser,
  mockActivateUser,
  mockDeleteUserPermanently,
  MockUserRepository,
} = vi.hoisted(() => {
  const mockBulkDeleteUsers = vi.fn();
  const mockSuspendUser = vi.fn();
  const mockActivateUser = vi.fn();
  const mockDeleteUserPermanently = vi.fn();

  class MockUserRepository {
    bulkDeleteUsers = mockBulkDeleteUsers;
    suspendUser = mockSuspendUser;
    activateUser = mockActivateUser;
    deleteUserPermanently = mockDeleteUserPermanently;
  }

  return {
    mockBulkDeleteUsers,
    mockSuspendUser,
    mockActivateUser,
    mockDeleteUserPermanently,
    MockUserRepository,
  };
});

vi.mock('../../lib/auth/rbac', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireSession: vi.fn(),
    requirePermission: vi.fn(),
  };
});

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    prisma: {},
    UserRepository: MockUserRepository,
  };
});

vi.mock('../../lib/email/resend', () => ({
  sendAccountSuspensionEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAccountDeletionEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAccountReactivationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

describe('User Lifecycle & Bulk Delete API Routes (TASK-0212)', () => {
  const mockOwnerSession = {
    id: 'usr-owner-1',
    roles: [UserRole.OWNER],
    accountStatus: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/users/bulk-delete', () => {
    it('1. rejects unauthenticated requests with 401', async () => {
      vi.mocked(rbacModule.requireSession).mockRejectedValueOnce(
        new rbacModule.AuthorizationError(401, 'UNAUTHORIZED', 'Authentication required')
      );

      const req = new NextRequest('http://localhost/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userIds: ['11111111-1111-4111-8111-111111111111'],
          reason: 'Cleanup test account',
        }),
      });

      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('2. rejects non-owners lacking account.deactivate permission with 403', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce({
        id: 'usr-admin-1',
        roles: [UserRole.ADMIN],
        accountStatus: 'ACTIVE',
      } as any);

      vi.mocked(rbacModule.requirePermission).mockImplementationOnce(() => {
        throw new rbacModule.AuthorizationError(403, 'FORBIDDEN', 'Insufficient permissions');
      });

      const req = new NextRequest('http://localhost/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userIds: ['11111111-1111-4111-8111-111111111111'],
          reason: 'Cleanup test account',
        }),
      });

      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('3. rejects requests with invalid body (empty userIds)', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const req = new NextRequest('http://localhost/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userIds: [],
        }),
      });

      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('4. successfully executes bulk delete and returns deleted count', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const targetIds = [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ];
      mockBulkDeleteUsers.mockResolvedValueOnce({
        success: true,
        deletedCount: 2,
        deletedUserIds: targetIds,
        errors: [],
      });

      const req = new NextRequest('http://localhost/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userIds: targetIds,
          reason: 'Ineligible seasonal staff cleanup',
        }),
      });

      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deletedCount).toBe(2);
      expect(json.data.deletedUserIds).toEqual(targetIds);
      expect(mockBulkDeleteUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserIds: targetIds,
          reason: 'Ineligible seasonal staff cleanup',
          actorUserId: 'usr-owner-1',
        })
      );
    });

    it('5. successfully executes bulk delete when reason is omitted and uses default deletion reason', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const targetIds = ['11111111-1111-4111-8111-111111111111'];
      mockBulkDeleteUsers.mockResolvedValueOnce({
        success: true,
        deletedCount: 1,
        deletedUserIds: targetIds,
        errors: [],
      });

      const req = new NextRequest('http://localhost/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userIds: targetIds,
        }),
      });

      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(200);
      expect(mockBulkDeleteUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserIds: targetIds,
          reason: 'Account permanently deleted by OWNER / PIC.',
          actorUserId: 'usr-owner-1',
        })
      );
    });
  });

  describe('POST /api/v1/users/[userId]/suspend', () => {
    it('1. rejects requests with invalid body (reason > 500 chars)', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const req = new NextRequest('http://localhost/api/v1/users/test-user/suspend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'a'.repeat(501) }),
      });

      const res = await suspendUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('2. suspends user with custom reason and dispatches notification', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);
      mockSuspendUser.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'test-user',
          fullName: 'Budi Test',
          accountStatus: 'SUSPENDED',
        },
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user/suspend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Policy violation on sensor usage' }),
      });

      const res = await suspendUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSuspendUser).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Policy violation on sensor usage',
          actorUserId: 'usr-owner-1',
        })
      );
    });

    it('3. suspends user with default reason when reason is omitted', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);
      mockSuspendUser.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'test-user',
          fullName: 'Budi Test',
          accountStatus: 'SUSPENDED',
        },
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user/suspend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await suspendUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSuspendUser).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Account suspended by OWNER / PIC.',
          actorUserId: 'usr-owner-1',
        })
      );
    });
  });

  describe('DELETE /api/v1/users/[userId]', () => {
    it('1. rejects requests with invalid body (reason > 500 chars)', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const req = new NextRequest('http://localhost/api/v1/users/test-user', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'x'.repeat(501) }),
      });

      const res = await deleteUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('2. permanently deletes user when valid reason is provided', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);
      mockDeleteUserPermanently.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'test-user',
          fullName: 'Budi Test',
        },
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Permanent contract termination' }),
      });

      const res = await deleteUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockDeleteUserPermanently).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Permanent contract termination',
          actorUserId: 'usr-owner-1',
        })
      );
    });

    it('3. permanently deletes user with default reason when omitted', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);
      mockDeleteUserPermanently.mockResolvedValueOnce({
        success: true,
        user: {
          id: 'test-user',
          fullName: 'Budi Test',
        },
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user', {
        method: 'DELETE',
      });

      const res = await deleteUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockDeleteUserPermanently).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Account permanently deleted by OWNER / PIC.',
          actorUserId: 'usr-owner-1',
        })
      );
    });
  });

  describe('POST /api/v1/users/[userId]/activate', () => {
    it('1. rejects unauthenticated requests with 401', async () => {
      vi.mocked(rbacModule.requireSession).mockRejectedValueOnce(
        new rbacModule.AuthorizationError(401, 'UNAUTHORIZED', 'Authentication required')
      );

      const req = new NextRequest('http://localhost/api/v1/users/test-user/activate', {
        method: 'POST',
      });

      const res = await activateUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('2. activates user with custom reason and dispatches reactivation notification via notifyFn', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const { sendAccountReactivationEmail } = await import('../../lib/email/resend');

      mockActivateUser.mockImplementationOnce(async (input: any) => {
        if (input.notifyFn) {
          await input.notifyFn({
            id: 'test-user',
            email: 'budi@test.com',
            fullName: 'Budi Test',
            reason: input.reason,
          });
        }
        return {
          success: true,
          user: {
            id: 'test-user',
            fullName: 'Budi Test',
            accountStatus: 'ACTIVE',
          },
        };
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Selesai masa audit operasional' }),
      });

      const res = await activateUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockActivateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Selesai masa audit operasional',
          actorUserId: 'usr-owner-1',
          notifyFn: expect.any(Function),
        })
      );
      expect(sendAccountReactivationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'budi@test.com',
          recipientName: 'Budi Test',
          reason: 'Selesai masa audit operasional',
        })
      );
    });

    it('3. activates user when reason is omitted and dispatches notification with default reason', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      const { sendAccountReactivationEmail } = await import('../../lib/email/resend');

      mockActivateUser.mockImplementationOnce(async (input: any) => {
        if (input.notifyFn) {
          await input.notifyFn({
            id: 'test-user',
            email: 'budi@test.com',
            fullName: 'Budi Test',
            reason: input.reason,
          });
        }
        return {
          success: true,
          user: {
            id: 'test-user',
            fullName: 'Budi Test',
            accountStatus: 'ACTIVE',
          },
        };
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user/activate', {
        method: 'POST',
      });

      const res = await activateUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockActivateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'test-user',
          reason: 'Account reactivated by OWNER / PIC.',
          actorUserId: 'usr-owner-1',
          notifyFn: expect.any(Function),
        })
      );
      expect(sendAccountReactivationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'budi@test.com',
          recipientName: 'Budi Test',
          reason: 'Account reactivated by OWNER / PIC.',
        })
      );
    });

    it('4. returns appropriate error status on repository failure', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValueOnce(mockOwnerSession as any);
      vi.mocked(rbacModule.requirePermission).mockReturnValueOnce(mockOwnerSession as any);

      mockActivateUser.mockResolvedValueOnce({
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: 'Account is already ACTIVE.',
        currentStatus: 'ACTIVE',
      });

      const req = new NextRequest('http://localhost/api/v1/users/test-user/activate', {
        method: 'POST',
      });

      const res = await activateUserRoute(req, {
        params: Promise.resolve({ userId: 'test-user' }),
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });
});
