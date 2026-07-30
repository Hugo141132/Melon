import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../route';
import { GET as GET_DETAIL, PATCH as PATCH_USER, DELETE as DELETE_USER } from '../[userId]/route';
import { POST as SUSPEND_USER } from '../[userId]/suspend/route';
import { POST as DEACTIVATE_USER } from '../[userId]/deactivate/route';
import { POST as ACTIVATE_USER } from '../[userId]/activate/route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';
import {
  requireActiveAccount,
  AuthorizationError,
  AuthenticatedUserSession,
} from '../../../../../lib/auth/rbac';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

const mockGetUsers = vi.fn();
const mockGetUserManagementById = vi.fn();
const mockUpdateOtherUserProfile = vi.fn();
const mockSuspendUser = vi.fn();
const mockDeactivateUser = vi.fn();
const mockActivateUser = vi.fn();
const mockDeleteUserPermanently = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    UserRepository: class {
      getUsers(...args: any[]) {
        return mockGetUsers(...args);
      }
      getUserManagementById(...args: any[]) {
        return mockGetUserManagementById(...args);
      }
      updateOtherUserProfile(...args: any[]) {
        return mockUpdateOtherUserProfile(...args);
      }
      suspendUser(...args: any[]) {
        return mockSuspendUser(...args);
      }
      deactivateUser(...args: any[]) {
        return mockDeactivateUser(...args);
      }
      activateUser(...args: any[]) {
        return mockActivateUser(...args);
      }
      deleteUserPermanently(...args: any[]) {
        return mockDeleteUserPermanently(...args);
      }
    },
  };
});

describe('TASK-0212 Owner User Management API & Safety Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockCookieToken = 'owner-token';
  });

  const mockOwnerSession = () => {
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
  };

  const mockAdminSession = () => {
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
        username: 'admin1',
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
  };

  // 1. Unauthenticated user-list request -> 401
  it('1. Unauthenticated user-list request returns 401 UNAUTHENTICATED', async () => {
    mockCookieToken = undefined;
    const req = new Request('http://localhost:3000/api/v1/users');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  // 2. ADMIN user-list request -> 403
  it('2. ADMIN user-list request returns 403 INSUFFICIENT_PERMISSION', async () => {
    mockAdminSession();
    const req = new Request('http://localhost:3000/api/v1/users');
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
  });

  // 3. OWNER can list users
  it('3. OWNER can list users with pagination metadata', async () => {
    mockOwnerSession();
    mockGetUsers.mockResolvedValueOnce({
      items: [
        {
          id: 'admin-id-2',
          fullName: 'Target Admin',
          email: 'target@test.com',
          username: 'targetadmin',
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date('2026-07-20T10:00:00Z'),
          updatedAt: new Date('2026-07-27T10:00:00Z'),
          activeRoles: [UserRole.ADMIN],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const req = new Request('http://localhost:3000/api/v1/users?page=1&pageSize=10');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe('admin-id-2');
    expect(json.meta.pagination.totalItems).toBe(1);
    expect(mockGetUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      role: undefined,
      accountStatus: undefined,
      search: undefined,
      sort: 'createdAt:desc',
    });
  });

  // 4. User-list DTO exposes no sensitive authentication fields
  it('4. User-list DTO exposes no passwordHash, sessionTokenHash, credentials or secrets', async () => {
    mockOwnerSession();
    mockGetUsers.mockResolvedValueOnce({
      items: [
        {
          id: 'admin-id-2',
          fullName: 'Target Admin',
          email: 'target@test.com',
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
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    const req = new Request('http://localhost:3000/api/v1/users');
    const res = await GET(req);
    const json = await res.json();

    expect(json.data[0]).not.toHaveProperty('passwordHash');
    expect(json.data[0]).not.toHaveProperty('sessionTokenHash');
    expect(json.data[0]).not.toHaveProperty('secret');
  });

  // 5. OWNER can view safe user detail
  it('5. OWNER can view safe user detail endpoint', async () => {
    mockOwnerSession();
    mockGetUserManagementById.mockResolvedValueOnce({
      id: 'admin-id-2',
      fullName: 'Target Admin',
      email: 'target@test.com',
      username: 'targetadmin',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date('2026-07-20T10:00:00Z'),
      updatedAt: new Date('2026-07-27T10:00:00Z'),
      activeRoles: [UserRole.ADMIN],
    });

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2');
    const res = await GET_DETAIL(req, { params: { userId: 'admin-id-2' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('admin-id-2');
    expect(json.data).not.toHaveProperty('passwordHash');
  });

  // 6. ADMIN cannot view Owner user-management detail endpoints
  it('6. ADMIN user-management detail request returns 403', async () => {
    mockAdminSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2');
    const res = await GET_DETAIL(req, { params: { userId: 'admin-id-2' } });

    expect(res.status).toBe(403);
  });

  // 7. OWNER can update an allowlisted target profile field (fullName, username)
  it('7. OWNER can update allowlisted profile fields (fullName, username) of an Admin', async () => {
    mockOwnerSession();
    mockUpdateOtherUserProfile.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'admin-id-2',
        fullName: 'Updated Admin Name',
        email: 'target@test.com',
        username: 'newusername',
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

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Updated Admin Name', username: 'newusername' }),
    });

    const res = await PATCH_USER(req, { params: { userId: 'admin-id-2' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.fullName).toBe('Updated Admin Name');
  });

  // 8. Generic profile update rejects role injection
  it('8. Generic profile update rejects role injection attempts (422)', async () => {
    mockOwnerSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'OWNER', fullName: 'Hacker' }),
    });

    const res = await PATCH_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  // 9. Generic profile update rejects accountStatus injection
  it('9. Generic profile update rejects accountStatus injection attempts (422)', async () => {
    mockOwnerSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountStatus: 'ACTIVE' }),
    });

    const res = await PATCH_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(422);
  });

  // 10. Generic profile update rejects email and internal-field injection
  it('10. Generic profile update rejects email and passwordHash injection attempts (422)', async () => {
    mockOwnerSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newemail@test.com', passwordHash: 'hacked' }),
    });

    const res = await PATCH_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(422);
  });

  // 11. OWNER can suspend a valid ACTIVE user
  it('11. OWNER can suspend a valid ACTIVE Admin user', async () => {
    mockOwnerSession();
    mockSuspendUser.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'admin-id-2',
        fullName: 'Target Admin',
        email: 'target@test.com',
        username: null,
        accountStatus: AccountStatus.SUSPENDED,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Policy violation' }),
    });

    const res = await SUSPEND_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accountStatus).toBe('SUSPENDED');
  });

  // 12. Suspension revokes existing target sessions & 13. Suspended user cannot continue using existing session
  it('12 & 13. Suspension revokes sessions and suspended user is rejected by requireActiveAccount (403)', async () => {
    mockOwnerSession();
    mockSuspendUser.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'admin-id-2',
        fullName: 'Target Admin',
        email: 'target@test.com',
        username: null,
        accountStatus: AccountStatus.SUSPENDED,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    // Run suspension
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2/suspend', {
      method: 'POST',
    });
    await SUSPEND_USER(req, { params: { userId: 'admin-id-2' } });

    // Now test that suspended user session is rejected by requireActiveAccount
    const suspendedSession: AuthenticatedUserSession = {
      id: 'admin-id-2',
      fullName: 'Target Admin',
      email: 'target@test.com',
      accountStatus: AccountStatus.SUSPENDED,
      activeRoles: [UserRole.ADMIN],
    };

    expect(() => requireActiveAccount(suspendedSession as any)).toThrowError(AuthorizationError);
  });

  // 14. OWNER can deactivate an eligible user & 15. Deactivation revokes sessions
  it('14 & 15. OWNER can deactivate an Admin and sessions are invalidated', async () => {
    mockOwnerSession();
    mockDeactivateUser.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'admin-id-2',
        fullName: 'Target Admin',
        email: 'target@test.com',
        username: null,
        accountStatus: AccountStatus.DEACTIVATED,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2/deactivate', {
      method: 'POST',
    });

    const res = await DEACTIVATE_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.accountStatus).toBe('DEACTIVATED');
  });

  // 16. Invalid lifecycle transitions fail cleanly (409 CONFLICT)
  it('16. Invalid lifecycle transitions fail with 409 CONFLICT', async () => {
    mockOwnerSession();
    mockActivateUser.mockResolvedValueOnce({
      success: false,
      error: 'INVALID_STATUS_TRANSITION',
      message: 'Pending approval accounts must be processed through the approval workflow.',
      currentStatus: AccountStatus.PENDING_APPROVAL,
    });

    const req = new Request('http://localhost:3000/api/v1/users/pending-admin-id/activate', {
      method: 'POST',
    });

    const res = await ACTIVATE_USER(req, { params: { userId: 'pending-admin-id' } });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  // 17. Permitted reactivation works according to policy
  it('17. Permitted reactivation of a SUSPENDED Admin succeeds (200)', async () => {
    mockOwnerSession();
    mockActivateUser.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'admin-id-2',
        fullName: 'Target Admin',
        email: 'target@test.com',
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

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2/activate', {
      method: 'POST',
    });

    const res = await ACTIVATE_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.accountStatus).toBe('ACTIVE');
  });

  // 20. ADMIN cannot invoke lifecycle-management actions (403)
  it('20. ADMIN cannot invoke suspend/deactivate/activate actions (403)', async () => {
    mockAdminSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2/suspend', {
      method: 'POST',
    });
    const res = await SUSPEND_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(403);
  });

  // 21. Last-Owner/self-management safety invariant is enforced
  it('21. Owner cannot suspend or deactivate another Owner or themselves (403 FORBIDDEN_TARGET)', async () => {
    mockOwnerSession();
    mockSuspendUser.mockResolvedValueOnce({
      success: false,
      error: 'FORBIDDEN_TARGET',
      message: 'Owner accounts cannot be suspended.',
    });

    const req = new Request('http://localhost:3000/api/v1/users/owner-id-1/suspend', {
      method: 'POST',
    });

    const res = await SUSPEND_USER(req, { params: { userId: 'owner-id-1' } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN_TARGET');
  });

  // 22. Permanent DELETE user endpoint by OWNER succeeds for eligible ADMIN
  it('22. OWNER can permanently delete an eligible Admin account (200)', async () => {
    mockOwnerSession();
    mockDeleteUserPermanently.mockResolvedValueOnce({
      success: true,
      data: { deletedUserId: 'admin-id-2' },
    });

    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'DELETE',
    });

    const res = await DELETE_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.deletedUserId).toBe('admin-id-2');
  });

  // 23. Permanent DELETE of PENDING_APPROVAL user returns 409 CANNOT_DELETE_PENDING_APPROVAL
  it('23. Permanent DELETE of PENDING_APPROVAL user returns 409 CANNOT_DELETE_PENDING_APPROVAL', async () => {
    mockOwnerSession();
    mockDeleteUserPermanently.mockResolvedValueOnce({
      success: false,
      error: 'CANNOT_DELETE_PENDING_APPROVAL',
      message: 'Pending approval accounts must be processed through approval workflow.',
      currentStatus: AccountStatus.PENDING_APPROVAL,
    });

    const req = new Request('http://localhost:3000/api/v1/users/pending-admin-id', {
      method: 'DELETE',
    });

    const res = await DELETE_USER(req, { params: { userId: 'pending-admin-id' } });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CANNOT_DELETE_PENDING_APPROVAL');
  });

  // 24. Permanent DELETE of OWNER account returns 403 FORBIDDEN_TARGET
  it('24. Permanent DELETE of OWNER account returns 403 FORBIDDEN_TARGET', async () => {
    mockOwnerSession();
    mockDeleteUserPermanently.mockResolvedValueOnce({
      success: false,
      error: 'FORBIDDEN_TARGET',
      message: 'Owner accounts cannot be deleted.',
    });

    const req = new Request('http://localhost:3000/api/v1/users/owner-id-1', {
      method: 'DELETE',
    });

    const res = await DELETE_USER(req, { params: { userId: 'owner-id-1' } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN_TARGET');
  });

  // 25. ADMIN cannot invoke DELETE endpoint (403)
  it('25. ADMIN cannot invoke DELETE endpoint (403 INSUFFICIENT_PERMISSION)', async () => {
    mockAdminSession();
    const req = new Request('http://localhost:3000/api/v1/users/admin-id-2', {
      method: 'DELETE',
    });
    const res = await DELETE_USER(req, { params: { userId: 'admin-id-2' } });
    expect(res.status).toBe(403);
  });
});
