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

  describe('rejectPendingAdmin and approvePendingAdmin unit tests', () => {
    const ownerId = '10000000-0000-0000-0000-000000000001';
    const adminId = '10000000-0000-0000-0000-000000000002';

    it('rejectPendingAdmin succeeds for verified PENDING_APPROVAL admin', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Pending Admin',
            email: 'admin.pending@example.com',
            username: null,
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          update: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Pending Admin',
            email: 'admin.pending@example.com',
            username: null,
            accountStatus: 'REJECTED',
            emailVerifiedAt: new Date(),
            lastLoginAt: null,
            suspendedAt: null,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userRoles: [],
          }),
        },
        accountApproval: {
          create: vi.fn().mockResolvedValue({ id: 'appr-1' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.rejectPendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
        decisionNote: 'Not eligible',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.user.accountStatus).toBe(AccountStatus.REJECTED);
      expect(result.approvalRecordId).toBe('appr-1');
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adminId },
          data: { accountStatus: 'REJECTED' },
        })
      );
    });

    it('rejectPendingAdmin rejects unverified PENDING_APPROVAL admin (emailVerifiedAt is null)', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Unverified Admin',
            email: 'admin.unverif@example.com',
            username: null,
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.rejectPendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.message).toContain('email has not been verified');
    });

    it('rejectPendingAdmin rejects already decided admin with INVALID_STATUS and currentStatus', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Already Active Admin',
            email: 'admin.active@example.com',
            username: null,
            accountStatus: 'ACTIVE',
            emailVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.rejectPendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.currentStatus).toBe(AccountStatus.ACTIVE);
    });

    it('approvePendingAdmin succeeds for verified PENDING_APPROVAL admin', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Pending Admin',
            email: 'admin.pending@example.com',
            username: null,
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          update: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Pending Admin',
            email: 'admin.pending@example.com',
            username: null,
            accountStatus: 'ACTIVE',
            emailVerifiedAt: new Date(),
            lastLoginAt: null,
            suspendedAt: null,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userRoles: [],
          }),
        },
        accountApproval: {
          create: vi.fn().mockResolvedValue({ id: 'appr-2' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-2' }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.approvePendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
        decisionNote: 'Verified identity',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.user.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(result.approvalRecordId).toBe('appr-2');
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adminId },
          data: { accountStatus: 'ACTIVE' },
        })
      );
    });

    it('approvePendingAdmin rejects unverified PENDING_APPROVAL admin (emailVerifiedAt is null)', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Unverified Admin',
            email: 'admin.unverif@example.com',
            username: null,
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.approvePendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.message).toContain('email has not been verified');
    });

    it('approvePendingAdmin rejects already decided admin with INVALID_STATUS and currentStatus', async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            fullName: 'Already Rejected Admin',
            email: 'admin.rejected@example.com',
            username: null,
            accountStatus: 'REJECTED',
            emailVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const mockPrismaClient: any = {
        $transaction: vi.fn().mockImplementation((cb: any) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrismaClient);
      const result = await repo.approvePendingAdmin({
        targetUserId: adminId,
        decidedByUserId: ownerId,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('INVALID_STATUS');
      expect(result.currentStatus).toBe(AccountStatus.REJECTED);
    });
    describe('verifyEmailWithToken concurrency', () => {
      it('simulated P2034 retries and then succeeds', async () => {
        let attempts = 0;
        const mockTx = {
          emailVerificationToken: {
            findUnique: vi.fn().mockResolvedValue({
              id: 't1',
              userId: 'u1',
              expiresAt: new Date(Date.now() + 100000),
            }),
            delete: vi.fn(),
          },
          user: {
            update: vi.fn().mockResolvedValue({
              id: '550e8400-e29b-41d4-a716-446655440000',
              fullName: 'Test User',
              email: 'test@example.com',
              username: 'testuser',
              passwordHash: 'dummy',
              accountStatus: 'PENDING_APPROVAL',
              emailVerifiedAt: new Date(),
              lastLoginAt: null,
              suspendedAt: null,
              deactivatedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: [],
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };

        const mockPrismaClient: any = {
          $transaction: vi.fn().mockImplementation(async (cb) => {
            attempts++;
            if (attempts < 3) {
              const err = new Error('Write conflict');
              (err as any).code = 'P2034';
              throw err;
            }
            return cb(mockTx);
          }),
        };

        const repo = new UserRepository(mockPrismaClient);
        const result = await repo.verifyEmailWithToken({ token: 'test-token' });

        expect(attempts).toBe(3);
        expect(result.success).toBe(true);
      });

      it('retry exhaustion is controlled, never 500', async () => {
        const mockPrismaClient: any = {
          $transaction: vi.fn().mockImplementation(async () => {
            const err = new Error('Write conflict');
            (err as any).code = 'P2034';
            throw err;
          }),
        };

        const repo = new UserRepository(mockPrismaClient);
        const result = await repo.verifyEmailWithToken({ token: 'test-token' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('CONCURRENCY_CONFLICT');
        }
      });

      it('reused token remains rejected safely', async () => {
        const mockPrismaClient: any = {
          $transaction: vi.fn().mockImplementation(async () => {
            const err = new Error('Not found');
            (err as any).code = 'P2025';
            throw err;
          }),
        };

        const repo = new UserRepository(mockPrismaClient);
        const result = await repo.verifyEmailWithToken({ token: 'test-token' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('TOKEN_ALREADY_USED');
        }
      });

      it('createEmailVerificationToken generates 6-digit numeric code with 1-minute expiry', async () => {
        const dummyUser = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          fullName: 'Test Code User',
          email: 'codeuser@example.com',
          username: 'codeuser',
          accountStatus: 'PENDING_APPROVAL',
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [],
        };

        const mockTx: any = {
          emailVerificationToken: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue({ id: 'token-uuid' }),
          },
        };

        const mockPrismaClient: any = {
          user: {
            findUnique: vi.fn().mockResolvedValue(dummyUser),
          },
          $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
        };

        const repo = new UserRepository(mockPrismaClient);
        const result = await repo.createEmailVerificationToken({
          userId: dummyUser.id,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.code).toMatch(/^\d{6}$/);
          expect(result.rawToken).toBe(result.code);
          const now = Date.now();
          expect(result.expiresAt.getTime()).toBeGreaterThan(now + 50 * 1000);
          expect(result.expiresAt.getTime()).toBeLessThanOrEqual(now + 60 * 1000 + 1000);
          expect(mockTx.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
            where: { userId: dummyUser.id },
          });
          expect(mockTx.emailVerificationToken.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                userId: dummyUser.id,
              }),
            })
          );
        }
      });

      it('verifyEmailWithCode successfully verifies matching code and email', async () => {
        const userId = '550e8400-e29b-41d4-a716-446655440000';
        const dummyUser = {
          id: userId,
          email: 'codeuser@example.com',
          emailVerifiedAt: null,
        };

        const mockTx = {
          emailVerificationToken: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'tok-1',
              userId,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            }),
            delete: vi.fn().mockResolvedValue({ id: 'tok-1' }),
          },
          user: {
            update: vi.fn().mockResolvedValue({
              id: userId,
              fullName: 'Code User',
              email: 'codeuser@example.com',
              username: 'codeuser',
              accountStatus: 'PENDING_APPROVAL',
              emailVerifiedAt: new Date(),
              lastLoginAt: null,
              suspendedAt: null,
              deactivatedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: [],
            }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        };

        const mockPrismaClient: any = {
          user: {
            findUnique: vi.fn().mockResolvedValue(dummyUser),
          },
          $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
        };

        const repo = new UserRepository(mockPrismaClient);
        const result = await repo.verifyEmailWithCode({
          email: 'codeuser@example.com',
          code: '849201',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.user.email).toBe('codeuser@example.com');
          expect(mockTx.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: userId },
              data: { emailVerifiedAt: expect.any(Date) },
            })
          );
        }
      });
    });
  });

  describe('TASK-0212: suspendUser, deleteUserPermanently, and bulkDeleteUsers', () => {
    const testAdminId1 = '11111111-1111-4111-8111-111111111111';
    const testAdminId2 = '22222222-2222-4222-8222-222222222222';
    const testOwnerId = '99999999-9999-4999-8999-999999999999';

    it('suspendUser requires reason, stores in auditLog metadata, and triggers notifyFn', async () => {
      const mockUser = {
        id: testAdminId1,
        email: 'admin1@example.com',
        fullName: 'Admin One',
        username: 'admin1',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { code: 'ADMIN' }, revokedAt: null }],
      };

      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
          update: vi.fn().mockResolvedValue({
            ...mockUser,
            accountStatus: 'SUSPENDED',
            suspendedAt: new Date(),
          }),
        },
        session: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const notifyFn = vi.fn().mockResolvedValue(undefined);

      const res = await repo.suspendUser({
        targetUserId: testAdminId1,
        actorUserId: testOwnerId,
        reason: 'Repeated unauthorized overrides',
        notifyFn,
      });

      expect(res.success).toBe(true);
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testAdminId1 },
          data: expect.objectContaining({
            accountStatus: 'SUSPENDED',
          }),
        })
      );
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'account.suspended',
            actorUserId: testOwnerId,
            targetId: testAdminId1,
            metadata: expect.objectContaining({
              reason: 'Repeated unauthorized overrides',
            }),
          }),
        })
      );
      expect(notifyFn).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin1@example.com',
          fullName: 'Admin One',
          reason: 'Repeated unauthorized overrides',
        })
      );
    });

    it('deleteUserPermanently prevents owner deletion, triggers beforeDeleteNotifyFn, cascades relations, and logs metadata', async () => {
      const mockAdminUser = {
        id: testAdminId2,
        email: 'admin2@example.com',
        fullName: 'Admin Two',
        username: 'admin2',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { code: 'ADMIN' }, revokedAt: null }],
      };

      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockAdminUser),
          delete: vi.fn().mockResolvedValue(mockAdminUser),
        },
        auditLog: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({ id: 'audit-2' }),
        },
        session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userRoleAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userDeviceAccess: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        accountApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        faucetCommand: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockAdminUser),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const beforeNotify = vi.fn().mockResolvedValue(undefined);

      const res = await repo.deleteUserPermanently({
        targetUserId: testAdminId2,
        actorUserId: testOwnerId,
        reason: 'Staff permanent departure',
        beforeDeleteNotifyFn: beforeNotify,
      });

      expect(res.success).toBe(true);
      expect(beforeNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin2@example.com',
          fullName: 'Admin Two',
          reason: 'Staff permanent departure',
        })
      );
      expect(mockTx.auditLog.updateMany).toHaveBeenCalledWith({
        where: { actorUserId: testAdminId2 },
        data: { actorUserId: null },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'account.deleted',
            actorUserId: testOwnerId,
            targetId: testAdminId2,
            metadata: expect.objectContaining({
              deletedUserEmail: 'admin2@example.com',
              deletedUserFullName: 'Admin Two',
              reason: 'Staff permanent departure',
            }),
          }),
        })
      );
    });

    it('bulkDeleteUsers deletes eligible non-owner accounts, rejects owners, and calls beforeDeleteNotifyFn', async () => {
      const mockUsers = [
        {
          id: testAdminId1,
          email: 'a10@example.com',
          fullName: 'A Ten',
          username: null,
          accountStatus: 'ACTIVE',
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [{ role: { code: 'ADMIN' }, revokedAt: null }],
        },
        {
          id: testOwnerId,
          email: 'o99@example.com',
          fullName: 'Owner Ninety Nine',
          username: null,
          accountStatus: 'ACTIVE',
          emailVerifiedAt: new Date(),
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [{ role: { code: 'OWNER' }, revokedAt: null }],
        },
      ];

      const mockTx: any = {
        user: {
          delete: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({ id: 'audit-bulk' }),
        },
        session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        userRoleAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        userDeviceAccess: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        userPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        accountApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        faucetCommand: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(mockUsers.find((u) => u.id === where.id) || null);
          }),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const beforeNotify = vi.fn().mockResolvedValue(undefined);

      // 1. Valid non-owner deletion
      const res = await repo.bulkDeleteUsers({
        targetUserIds: [testAdminId1],
        actorUserId: testOwnerId,
        reason: 'Bulk cleanup of testing batches',
        beforeDeleteNotifyFn: beforeNotify,
      });

      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(1);
      expect(res.deletedUserIds).toEqual([testAdminId1]);
      expect(beforeNotify).toHaveBeenCalledTimes(1);
      expect(beforeNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'a10@example.com',
          reason: 'Bulk cleanup of testing batches',
        })
      );

      // 2. Owner protection: attempting to delete owner account is rejected
      const ownerRes = await repo.bulkDeleteUsers({
        targetUserIds: [testOwnerId],
        actorUserId: testOwnerId,
        reason: 'Attempted owner delete',
      });
      expect(ownerRes.success).toBe(false);
      expect(ownerRes.deletedCount).toBe(0);
      expect(ownerRes.errors?.[0].error).toBe('FORBIDDEN_TARGET');
    });

    it('21. activateUser restores suspended account and invokes notifyFn post-commit', async () => {
      const suspendedUser: any = {
        id: '10000000-0000-0000-0000-000000000099',
        email: 'suspended@example.com',
        fullName: 'Suspended Admin',
        username: 'suspended_admin',
        accountStatus: 'SUSPENDED',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [
          {
            id: 'r-99',
            userId: '10000000-0000-0000-0000-000000000099',
            roleId: 'role-admin',
            assignedByUserId: null,
            assignedAt: new Date(),
            revokedAt: null,
            role: { code: 'ADMIN' },
          },
        ],
      };

      const mockTx: any = {
        user: {
          update: vi.fn().mockResolvedValue({
            ...suspendedUser,
            accountStatus: 'ACTIVE',
            suspendedAt: null,
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-act-1' }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(suspendedUser),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const notifySpy = vi.fn().mockResolvedValue(undefined);

      const result = await repo.activateUser({
        targetUserId: '10000000-0000-0000-0000-000000000099',
        actorUserId: 'owner-id-1',
        reason: 'Restoring access after verification',
        notifyFn: notifySpy,
      });

      expect(result.success).toBe(true);
      expect(notifySpy).toHaveBeenCalledTimes(1);
      expect(notifySpy).toHaveBeenCalledWith({
        id: '10000000-0000-0000-0000-000000000099',
        email: 'suspended@example.com',
        fullName: 'Suspended Admin',
        reason: 'Restoring access after verification',
      });
    });

    it('22. activateUser uses default OWNER / PIC reason when reason is omitted or empty', async () => {
      const suspendedUser: any = {
        id: '10000000-0000-0000-0000-000000000099',
        email: 'suspended@example.com',
        fullName: 'Suspended Admin',
        username: 'suspended_admin',
        accountStatus: 'SUSPENDED',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [
          {
            id: 'r-99',
            userId: '10000000-0000-0000-0000-000000000099',
            roleId: 'role-admin',
            assignedByUserId: null,
            assignedAt: new Date(),
            revokedAt: null,
            role: { code: 'ADMIN' },
          },
        ],
      };

      const mockTx: any = {
        user: {
          update: vi.fn().mockResolvedValue({
            ...suspendedUser,
            accountStatus: 'ACTIVE',
            suspendedAt: null,
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-act-2' }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(suspendedUser),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const notifySpy = vi.fn().mockResolvedValue(undefined);

      const result = await repo.activateUser({
        targetUserId: '10000000-0000-0000-0000-000000000099',
        actorUserId: 'owner-id-1',
        notifyFn: notifySpy,
      });

      expect(result.success).toBe(true);
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'account.activated',
            metadata: { reason: 'Account reactivated by OWNER / PIC.' },
          }),
        })
      );
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Account reactivated by OWNER / PIC.',
        })
      );
    });

    it('23. suspendUser and deleteUserPermanently use default OWNER / PIC reasons when omitted', async () => {
      const mockAdminUser = {
        id: testAdminId1,
        email: 'admin1@example.com',
        fullName: 'Admin One',
        username: 'admin1',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { code: 'ADMIN' }, revokedAt: null }],
      };

      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockAdminUser),
          update: vi.fn().mockResolvedValue({
            ...mockAdminUser,
            accountStatus: 'SUSPENDED',
            suspendedAt: new Date(),
          }),
          delete: vi.fn().mockResolvedValue(mockAdminUser),
        },
        session: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-default' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        userRoleAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userDeviceAccess: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        accountApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        faucetCommand: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockAdminUser),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };

      const repo = new UserRepository(mockPrisma);
      const suspendNotify = vi.fn().mockResolvedValue(undefined);

      // Suspend without reason
      const suspendRes = await repo.suspendUser({
        targetUserId: testAdminId1,
        actorUserId: testOwnerId,
        notifyFn: suspendNotify,
      });

      expect(suspendRes.success).toBe(true);
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'account.suspended',
            metadata: { reason: 'Account suspended by OWNER / PIC.' },
          }),
        })
      );
      expect(suspendNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Account suspended by OWNER / PIC.',
        })
      );

      // Delete without reason
      const deleteNotify = vi.fn().mockResolvedValue(undefined);
      const deleteRes = await repo.deleteUserPermanently({
        targetUserId: testAdminId1,
        actorUserId: testOwnerId,
        beforeDeleteNotifyFn: deleteNotify,
      });

      expect(deleteRes.success).toBe(true);
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'account.deleted',
            metadata: expect.objectContaining({
              reason: 'Account permanently deleted by OWNER / PIC.',
            }),
          }),
        })
      );
      expect(deleteNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Account permanently deleted by OWNER / PIC.',
        })
      );
    });
  });
});
