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
});
