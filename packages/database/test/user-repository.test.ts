import { describe, it, expect, vi } from 'vitest';
import { UserRepository } from '../src/user-repository';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

describe('UserRepository Unit Tests', () => {
  it('maps database user to PublicSafeUserDto using Prisma select allow-list and excludes passwordHash', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: '10000000-0000-0000-0000-000000000001',
      fullName: 'Repository Admin',
      email: 'Repo.Admin@KebunMelon.id',
      username: null,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date('2026-07-28T00:00:00Z'),
      updatedAt: new Date('2026-07-28T00:00:00Z'),
      userRoles: [
        {
          id: 'r1',
          userId: '10000000-0000-0000-0000-000000000001',
          roleId: 'role1',
          assignedByUserId: null,
          assignedAt: new Date(),
          revokedAt: null,
          role: { code: 'ADMIN' },
        },
      ],
    });

    const mockPrismaClient: any = {
      user: {
        findUnique: findUniqueMock,
      },
    };

    const repo = new UserRepository(mockPrismaClient);
    const dto = await repo.findUserById('10000000-0000-0000-0000-000000000001');

    expect(dto).not.toBeNull();
    expect(dto!.id).toBe('10000000-0000-0000-0000-000000000001');
    expect(dto!.email).toBe('repo.admin@kebunmelon.id');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('sessionTokenHash');
    expect(dto!.activeRoles).toEqual([UserRole.ADMIN]);

    // Verify Prisma query used allow-list select
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: '10000000-0000-0000-0000-000000000001' },
      select: expect.objectContaining({
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
      }),
    });
    expect(findUniqueMock.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
  });

  it('normalises email before querying in findUserByNormalisedEmail', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue(null);
    const mockPrismaClient: any = {
      user: {
        findUnique: findUniqueMock,
      },
    };

    const repo = new UserRepository(mockPrismaClient);
    const searchEmail = '   Admin.Search@Example.COM  ';
    const emailCopy = searchEmail;

    await repo.findUserByNormalisedEmail(searchEmail);

    expect(searchEmail).toBe(emailCopy); // Input immutability
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin.search@example.com' },
      })
    );
  });

  it('returns null when user is not found', async () => {
    const mockPrismaClient: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    const repo = new UserRepository(mockPrismaClient);
    const result = await repo.findUserById('non-existent-id');
    expect(result).toBeNull();

    const status = await repo.readAccountStatus('non-existent-id');
    expect(status).toBeNull();
  });

  it('filters out revoked role assignments in readActiveRoleAssignments', async () => {
    const mockPrismaClient: any = {
      userRoleAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            role: { code: 'ADMIN' },
          },
        ]),
      },
    };

    const repo = new UserRepository(mockPrismaClient);
    const activeRoles = await repo.readActiveRoleAssignments('u1');

    expect(activeRoles).toEqual([UserRole.ADMIN]);
    expect(mockPrismaClient.userRoleAssignment.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        revokedAt: null,
      },
      select: {
        role: {
          select: {
            code: true,
          },
        },
      },
    });
  });

  it('deleteUserPermanently creates account.deleted audit log containing strictly NO PII', async () => {
    const targetId = '10000000-0000-0000-0000-000000000002';
    const actorId = '10000000-0000-0000-0000-000000000001';
    const mockAuditLogCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });

    const mockTx = {
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      userPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      userRoleAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      accountApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      userDeviceAccess: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      faucetCommand: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      faucetCommandEvent: { deleteMany: vi.fn() },
      alertAcknowledgement: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: mockAuditLogCreate },
      user: { delete: vi.fn().mockResolvedValue({ id: targetId }) },
    };

    const mockPrismaClient: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: targetId,
          fullName: 'Sensitive Target Admin',
          email: 'sensitive.admin@test.com',
          username: 'sensitiveadmin',
          accountStatus: 'ACTIVE',
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [
            {
              id: 'ur1',
              userId: targetId,
              roleId: 'r1',
              assignedByUserId: actorId,
              assignedAt: new Date(),
              revokedAt: null,
              role: { code: 'ADMIN' },
            },
          ],
        }),
      },
      userRoleAssignment: {
        findMany: vi.fn().mockResolvedValue([{ role: { code: 'ADMIN' } }]),
      },
      $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    const repo = new UserRepository(mockPrismaClient);
    const result = await repo.deleteUserPermanently({
      targetUserId: targetId,
      actorUserId: actorId,
      reason: 'Privacy verification test',
    });

    expect(result.success).toBe(true);

    // Verify audit log creation call arguments contain NO PII
    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    const auditArg = mockAuditLogCreate.mock.calls[0][0].data;

    expect(auditArg.eventKey).toBe('account.deleted');
    expect(auditArg.actorUserId).toBe(actorId);
    expect(auditArg.targetId).toBe(targetId);

    // Assert strictly NO PII in previousValues or metadata
    const prevValues = auditArg.previousValues;
    expect(prevValues).not.toHaveProperty('email');
    expect(prevValues).not.toHaveProperty('fullName');
    expect(prevValues).not.toHaveProperty('username');
    expect(prevValues).not.toHaveProperty('passwordHash');
    expect(prevValues).not.toHaveProperty('sessionToken');
    expect(prevValues).not.toHaveProperty('secret');
  });

  it('updateUserPreference upserts preference and writes audit log', async () => {
    const userId = '10000000-0000-0000-0000-000000000001';
    const mockAuditLogCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const mockUpsert = vi.fn().mockResolvedValue({
      id: 'pref-1',
      userId,
      preferredLocale: 'en',
      timezone: 'Asia/Jakarta',
      defaultDeviceId: null,
    });

    const mockTx: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: userId, accountStatus: 'ACTIVE' }),
      },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pref-1',
          userId,
          preferredLocale: 'id',
          timezone: 'Asia/Jakarta',
          defaultDeviceId: null,
        }),
        upsert: mockUpsert,
      },
      auditLog: {
        create: mockAuditLogCreate,
      },
    };

    const mockPrismaClient: any = {
      $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    const repo = new UserRepository(mockPrismaClient);
    const result = await repo.updateUserPreference({
      userId,
      preferredLocale: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.preferences?.preferredLocale).toBe('en');
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId },
      update: { preferredLocale: 'en' },
      create: {
        userId,
        preferredLocale: 'en',
        timezone: 'Asia/Jakarta',
        defaultDeviceId: null,
      },
    });
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventKey: 'profile.self.updated',
          actorUserId: userId,
          targetType: 'USER',
          targetId: userId,
          result: 'SUCCESS',
          newValues: { preferredLocale: 'en' },
        }),
      })
    );
  });
});
