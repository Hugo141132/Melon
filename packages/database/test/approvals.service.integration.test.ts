import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../src/user-repository';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import { execSync } from 'child_process';

describe('TASK-0206 Approvals Database Integration & Security Test Suite', () => {
  let prisma: PrismaClient;
  let userRepo: UserRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    userRepo = new UserRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up dependent tables and test users
    await prisma.faucetCommandEvent.deleteMany({});
    await prisma.faucetCommand.deleteMany({});
    await prisma.userDeviceAccess.deleteMany({});
    await prisma.alertAcknowledgement.deleteMany({});
    await prisma.alert.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.accountApproval.deleteMany({});
    await prisma.userRoleAssignment.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.userPreference.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('getPendingApprovals filters strictly by PENDING_APPROVAL and excludes passwordHash & secret fields', async () => {
    // Seed 1 active user, 1 pending admin user, 1 rejected user
    const pendingUser = await prisma.user.create({
      data: {
        fullName: 'Pending Applicant Alpha',
        email: 'alpha@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash1',
        accountStatus: AccountStatus.PENDING_APPROVAL,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        fullName: 'Active Admin Beta',
        email: 'beta@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash2',
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        fullName: 'Rejected Admin Gamma',
        email: 'gamma@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash3',
        accountStatus: AccountStatus.REJECTED,
      },
    });

    const result = await userRepo.getPendingApprovals({ page: 1, pageSize: 10 });

    expect(result.items.length).toBe(1);
    expect(result.items[0].userId).toBe(pendingUser.id);
    expect(result.items[0].fullName).toBe('Pending Applicant Alpha');
    expect(result.items[0].accountStatus).toBe(AccountStatus.PENDING_APPROVAL);

    // Verify secret fields are not in the response object
    const rawItem = result.items[0] as any;
    expect(rawItem.passwordHash).toBeUndefined();
    expect(rawItem.sessionTokenHash).toBeUndefined();
    expect(result.pagination.totalItems).toBe(1);
  });

  it('getPendingApprovalById returns item details if PENDING_APPROVAL, or null if non-existent or active', async () => {
    const pendingUser = await prisma.user.create({
      data: {
        fullName: 'Pending Applicant Delta',
        email: 'delta@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash4',
        accountStatus: AccountStatus.PENDING_APPROVAL,
        emailVerifiedAt: new Date(),
      },
    });

    const activeUser = await prisma.user.create({
      data: {
        fullName: 'Active User Epsilon',
        email: 'epsilon@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash5',
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    const pendingResult = await userRepo.getPendingApprovalById(pendingUser.id);
    expect(pendingResult).not.toBeNull();
    expect(pendingResult?.userId).toBe(pendingUser.id);
    expect(pendingResult?.email).toBe('delta@example.com');

    const activeResult = await userRepo.getPendingApprovalById(activeUser.id);
    expect(activeResult).toBeNull();

    const missingResult = await userRepo.getPendingApprovalById(
      '00000000-0000-0000-0000-000000000000'
    );
    expect(missingResult).toBeNull();
  });

  describe('TASK-0207 approvePendingAdmin Integration Tests', () => {
    it('transactionally approves pending admin, inserts AccountApproval history, and records AuditLog without secrets', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin To Approve',
          email: 'admin.pending@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashpending',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      let notifyCalled = false;
      const notifyFn = async (applicant: { id: string; email: string; fullName: string }) => {
        notifyCalled = true;
        expect(applicant.id).toBe(pendingUser.id);
      };

      const result = await userRepo.approvePendingAdmin({
        targetUserId: pendingUser.id,
        decidedByUserId: ownerUser.id,
        decisionNote: 'Verified identity and credentials',
        requestId: 'req-integration-test-1',
        notifyFn,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.user.id).toBe(pendingUser.id);
      expect(result.user.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(notifyCalled).toBe(true);

      // Verify DB User account status update
      const dbUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
      expect(dbUser?.accountStatus).toBe(AccountStatus.ACTIVE);

      // Verify AccountApproval history record
      const approvalHistory = await prisma.accountApproval.findUnique({
        where: { id: result.approvalRecordId },
      });
      expect(approvalHistory).not.toBeNull();
      expect(approvalHistory?.applicantUserId).toBe(pendingUser.id);
      expect(approvalHistory?.decidedByUserId).toBe(ownerUser.id);
      expect(approvalHistory?.decision).toBe('APPROVE');
      expect(approvalHistory?.previousStatus).toBe(AccountStatus.PENDING_APPROVAL);
      expect(approvalHistory?.newStatus).toBe(AccountStatus.ACTIVE);
      expect(approvalHistory?.decisionNote).toBe('Verified identity and credentials');

      // Verify AuditLog record and audit secrecy (no password hashes or secrets in values/metadata)
      const auditLog = await prisma.auditLog.findUnique({
        where: { id: result.auditLogId },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventKey).toBe('account.approved');
      expect(auditLog?.actorUserId).toBe(ownerUser.id);
      expect(auditLog?.targetId).toBe(pendingUser.id);
      expect(auditLog?.targetType).toBe('USER');
      expect(auditLog?.result).toBe('SUCCESS');

      const auditString = JSON.stringify(auditLog);
      expect(auditString).not.toContain('passwordHash');
      expect(auditString).not.toContain('dummyhash');
    });

    it('rejects approval with CONFLICT / INVALID_STATUS if target is already ACTIVE or REJECTED', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner2@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner2',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const approvedUser = await prisma.user.create({
        data: {
          fullName: 'Already Active Admin',
          email: 'admin.approved@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashapp',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const result = await userRepo.approvePendingAdmin({
        targetUserId: approvedUser.id,
        decidedByUserId: ownerUser.id,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.currentStatus).toBe(AccountStatus.ACTIVE);

      // Verify no new AccountApproval record created
      const approvals = await prisma.accountApproval.findMany({
        where: { applicantUserId: approvedUser.id },
      });
      expect(approvals.length).toBe(0);
    });

    it('rejects approval with INVALID_STATUS if target is unverified (emailVerifiedAt is null)', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner2_unverif@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner2',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const unverifiedUser = await prisma.user.create({
        data: {
          fullName: 'Unverified Admin',
          email: 'admin.unverified@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashapp',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: null,
        },
      });

      const result = await userRepo.approvePendingAdmin({
        targetUserId: unverifiedUser.id,
        decidedByUserId: ownerUser.id,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.message).toContain('email has not been verified');
    });

    it('isolates decision from notification failure (notification throwing error does not roll back approval)', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner3@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner3',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin Fails Notify',
          email: 'admin.failnotify@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfailnotify',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      const failingNotifyFn = async () => {
        throw new Error('SMTP_SERVER_UNAVAILABLE');
      };

      const result = await userRepo.approvePendingAdmin({
        targetUserId: pendingUser.id,
        decidedByUserId: ownerUser.id,
        notifyFn: failingNotifyFn,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const dbUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
      expect(dbUser?.accountStatus).toBe(AccountStatus.ACTIVE);
    });

    it('handles two concurrent approval requests producing exactly 1 success, 1 conflict, 1 AccountApproval record, and 1 AuditLog', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner4@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner4',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin Concurrent',
          email: 'admin.concurrent@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashconcurrent',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      const [res1, res2] = await Promise.all([
        userRepo.approvePendingAdmin({
          targetUserId: pendingUser.id,
          decidedByUserId: ownerUser.id,
          decisionNote: 'Concurrent attempt 1',
        }),
        userRepo.approvePendingAdmin({
          targetUserId: pendingUser.id,
          decidedByUserId: ownerUser.id,
          decisionNote: 'Concurrent attempt 2',
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.success);
      const failures = [res1, res2].filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify DB User is ACTIVE
      const dbUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
      expect(dbUser?.accountStatus).toBe(AccountStatus.ACTIVE);

      // Verify exactly 1 AccountApproval record
      const approvalRecords = await prisma.accountApproval.findMany({
        where: { applicantUserId: pendingUser.id },
      });
      expect(approvalRecords.length).toBe(1);

      // Verify exactly 1 AuditLog record
      const auditLogs = await prisma.auditLog.findMany({
        where: { targetId: pendingUser.id, eventKey: 'account.approved' },
      });
      expect(auditLogs.length).toBe(1);
    });

    it('leaves status, approval history, and audit log unchanged when database transaction fails', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner5@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner5',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin Tx Fail',
          email: 'admin.txfail@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashtxfail',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      // Pass an invalid non-existent decidedByUserId to trigger DB foreign key constraint violation inside transaction
      const result = await userRepo.approvePendingAdmin({
        targetUserId: pendingUser.id,
        decidedByUserId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INTERNAL_ERROR');

      // Verify database state was fully rolled back
      const dbUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
      expect(dbUser?.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);

      const approvalRecords = await prisma.accountApproval.findMany({
        where: { applicantUserId: pendingUser.id },
      });
      expect(approvalRecords.length).toBe(0);

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetId: pendingUser.id },
      });
      expect(auditLogs.length).toBe(0);
    });
  });

  describe('TASK-0208 rejectPendingAdmin Integration Tests', () => {
    it('transactionally rejects pending admin, inserts AccountApproval history with decision REJECT, and records AuditLog without secrets', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner.reject@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin To Reject',
          email: 'admin.pending.reject@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashpending',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      let notifyCalled = false;
      const notifyFn = async (applicant: { id: string; email: string; fullName: string }) => {
        notifyCalled = true;
        expect(applicant.id).toBe(pendingUser.id);
      };

      const result = await userRepo.rejectPendingAdmin({
        targetUserId: pendingUser.id,
        decidedByUserId: ownerUser.id,
        decisionNote: 'Unverified credentials and identity mismatch',
        requestId: 'req-reject-test-1',
        notifyFn,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.user.id).toBe(pendingUser.id);
      expect(result.user.accountStatus).toBe(AccountStatus.REJECTED);
      expect(notifyCalled).toBe(true);

      // Verify DB User account status update
      const dbUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
      expect(dbUser?.accountStatus).toBe(AccountStatus.REJECTED);

      // Verify AccountApproval history record
      const approvalHistory = await prisma.accountApproval.findUnique({
        where: { id: result.approvalRecordId },
      });
      expect(approvalHistory).not.toBeNull();
      expect(approvalHistory?.applicantUserId).toBe(pendingUser.id);
      expect(approvalHistory?.decidedByUserId).toBe(ownerUser.id);
      expect(approvalHistory?.decision).toBe('REJECT');
      expect(approvalHistory?.previousStatus).toBe(AccountStatus.PENDING_APPROVAL);
      expect(approvalHistory?.newStatus).toBe(AccountStatus.REJECTED);
      expect(approvalHistory?.decisionNote).toBe('Unverified credentials and identity mismatch');

      // Verify AuditLog record and audit secrecy (no password hashes or secrets in values/metadata)
      const auditLog = await prisma.auditLog.findUnique({
        where: { id: result.auditLogId },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventKey).toBe('account.rejected');
      expect(auditLog?.actorUserId).toBe(ownerUser.id);
      expect(auditLog?.targetId).toBe(pendingUser.id);
      expect(auditLog?.targetType).toBe('USER');
      expect(auditLog?.result).toBe('SUCCESS');

      const auditString = JSON.stringify(auditLog);
      expect(auditString).not.toContain('passwordHash');
      expect(auditString).not.toContain('dummyhash');
    });

    it('rejects rejection request with CONFLICT / INVALID_STATUS if target is not PENDING_APPROVAL', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner.reject2@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner2',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const alreadyRejectedUser = await prisma.user.create({
        data: {
          fullName: 'Already Rejected Admin',
          email: 'admin.rejected@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashapp',
          accountStatus: AccountStatus.REJECTED,
        },
      });

      const result = await userRepo.rejectPendingAdmin({
        targetUserId: alreadyRejectedUser.id,
        decidedByUserId: ownerUser.id,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.currentStatus).toBe(AccountStatus.REJECTED);

      // Verify no new AccountApproval record created
      const approvals = await prisma.accountApproval.findMany({
        where: { applicantUserId: alreadyRejectedUser.id },
      });
      expect(approvals.length).toBe(0);
    });

    it('rejects rejection request with INVALID_STATUS if target is unverified (emailVerifiedAt is null)', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner_reject_unverif@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner2',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const unverifiedUser = await prisma.user.create({
        data: {
          fullName: 'Unverified Admin Reject',
          email: 'admin.reject.unverified@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashapp',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: null,
        },
      });

      const result = await userRepo.rejectPendingAdmin({
        targetUserId: unverifiedUser.id,
        decidedByUserId: ownerUser.id,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.message).toContain('email has not been verified');
    });

    it('handles two concurrent rejection/approval requests producing exactly 1 success and 1 conflict', async () => {
      const ownerUser = await prisma.user.create({
        data: {
          fullName: 'Owner User',
          email: 'owner.concurrent.reject@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashowner4',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      const pendingUser = await prisma.user.create({
        data: {
          fullName: 'Pending Admin Concurrent Reject',
          email: 'admin.concurrent.reject@example.com',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashconcurrent',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      const [res1, res2] = await Promise.all([
        userRepo.rejectPendingAdmin({
          targetUserId: pendingUser.id,
          decidedByUserId: ownerUser.id,
          decisionNote: 'Concurrent reject attempt 1',
        }),
        userRepo.approvePendingAdmin({
          targetUserId: pendingUser.id,
          decidedByUserId: ownerUser.id,
          decisionNote: 'Concurrent approve attempt 2',
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.success);
      const failures = [res1, res2].filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify exactly 1 AccountApproval record
      const approvalRecords = await prisma.accountApproval.findMany({
        where: { applicantUserId: pendingUser.id },
      });
      expect(approvalRecords.length).toBe(1);
    });
  });
});
