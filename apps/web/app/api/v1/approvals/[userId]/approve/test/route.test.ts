import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as approvePOST } from '../route';
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
const mockApprovePendingAdmin = vi.fn();

vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  SESSION_COOKIE_NAME: 'session_token',
  validateSession: (...args: any[]) => mockValidateSession(...args),
  UserRepository: vi.fn().mockImplementation(() => ({
    readActiveRoleAssignments: (...args: any[]) => mockReadActiveRoleAssignments(...args),
    approvePendingAdmin: (...args: any[]) => mockApprovePendingAdmin(...args),
  })),
}));

describe('TASK-0207 Owner Approve API Route Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-owner-token';
  });

  it('returns 401 UNAUTHENTICATED if session token is missing', async () => {
    mockCookieToken = undefined;

    const req = new Request('http://localhost:3000/api/v1/approvals/target-id-1/approve', {
      method: 'POST',
    });

    const res = await approvePOST(req, { params: { userId: 'target-id-1' } });
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

    mockReadActiveRoleAssignments.mockResolvedValueOnce([UserRole.ADMIN]);

    const req = new Request('http://localhost:3000/api/v1/approvals/target-id-1/approve', {
      method: 'POST',
    });
    const res = await approvePOST(req, { params: { userId: 'target-id-1' } });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('returns 404 USER_NOT_FOUND if target applicant does not exist', async () => {
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

    mockApprovePendingAdmin.mockResolvedValueOnce({
      success: false,
      error: 'USER_NOT_FOUND',
      message: "Target user with ID 'missing-id' does not exist.",
    });

    const req = new Request('http://localhost:3000/api/v1/approvals/missing-id/approve', {
      method: 'POST',
    });
    const res = await approvePOST(req, { params: { userId: 'missing-id' } });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 409 CONFLICT if target user is not in PENDING_APPROVAL status (already approved/rejected)', async () => {
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

    mockApprovePendingAdmin.mockResolvedValueOnce({
      success: false,
      error: 'INVALID_STATUS',
      message: "Target user is in status 'APPROVED', not PENDING_APPROVAL.",
      currentStatus: AccountStatus.APPROVED,
    });

    const req = new Request('http://localhost:3000/api/v1/approvals/already-approved-id/approve', {
      method: 'POST',
    });
    const res = await approvePOST(req, { params: { userId: 'already-approved-id' } });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('CONFLICT');
    expect(json.error.details.currentStatus).toBe(AccountStatus.APPROVED);
  });

  it('returns 200 OK with approved user DTO for valid OWNER approval', async () => {
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

    const mockApprovedUser = {
      id: 'target-id-1',
      fullName: 'Approved Admin',
      email: 'approved@example.com',
      username: null,
      accountStatus: AccountStatus.ACTIVE,
      roles: [UserRole.ADMIN],
      createdAt: '2026-07-28T10:00:00.000Z',
      updatedAt: '2026-07-29T12:00:00.000Z',
    };

    mockApprovePendingAdmin.mockResolvedValueOnce({
      success: true,
      user: mockApprovedUser,
      approvalRecordId: 'approval-rec-123',
      auditLogId: 'audit-log-456',
    });

    const req = new Request('http://localhost:3000/api/v1/approvals/target-id-1/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionNote: 'Verified identity via phone call' }),
    });
    const res = await approvePOST(req, { params: { userId: 'target-id-1' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(json.data.approvalRecordId).toBe('approval-rec-123');
    expect(json.data.user).not.toHaveProperty('passwordHash');
    expect(json.data.user).not.toHaveProperty('sessionTokenHash');
  });
});
