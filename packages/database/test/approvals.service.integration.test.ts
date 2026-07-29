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
    // Clean up test users and roles
    await prisma.userRoleAssignment.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.accountApproval.deleteMany({});
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
});
