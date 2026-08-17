import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { UserRepository } from '../src/user-repository';
import { AccountStatus, AuditEventKey, UserRole } from '@kebun-melon/contracts';

const VALID_USER_ID = '10000000-0000-0000-0000-000000000001';
const VALID_TOKEN_ID = '20000000-0000-0000-0000-000000000002';

describe('TASK-0213 Password Reset Repository Unit Test Suite', () => {
  describe('createPasswordResetToken', () => {
    it('returns userExists: false when user is not found without leaking info', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.createPasswordResetToken({
        email: 'unknown@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.userExists).toBe(false);
    });

    it('creates reset token for existing user regardless of accountStatus (e.g. PENDING_APPROVAL)', async () => {
      let createdTokenData: any = null;
      const mockTx: any = {
        passwordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockImplementation((args) => {
            createdTokenData = args.data;
            return Promise.resolve({ id: VALID_TOKEN_ID, ...args.data });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-01' }),
        },
      };
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            fullName: 'Pending User',
            email: 'pending@example.com',
            username: 'pendinguser',
            accountStatus: AccountStatus.PENDING_APPROVAL,
            emailVerifiedAt: null,
            lastLoginAt: null,
            suspendedAt: null,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userRoles: [],
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.createPasswordResetToken({
        email: 'pending@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);
        expect(createdTokenData.userId).toBe(VALID_USER_ID);
      }
    });

    it('creates single-use token, stores SHA-256 hash at rest, and logs audit event for ACTIVE user', async () => {
      let createdTokenData: any = null;
      let createdAuditData: any = null;
      let invalidatedWhere: any = null;

      const mockTx: any = {
        passwordResetToken: {
          updateMany: vi.fn().mockImplementation((args) => {
            invalidatedWhere = args.where;
            return Promise.resolve({ count: 1 });
          }),
          create: vi.fn().mockImplementation((args) => {
            createdTokenData = args.data;
            return Promise.resolve({ id: VALID_TOKEN_ID, ...args.data });
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditData = args.data;
            return Promise.resolve({ id: 'audit-01', ...args.data });
          }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            fullName: 'Active User',
            email: 'active@example.com',
            username: 'activeuser',
            passwordHash: 'hash',
            accountStatus: AccountStatus.ACTIVE,
            emailVerifiedAt: null,
            lastLoginAt: null,
            suspendedAt: null,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userRoles: [
              {
                id: 'role-assign-1',
                userId: VALID_USER_ID,
                roleId: 'role-1',
                assignedByUserId: null,
                assignedAt: new Date(),
                revokedAt: null,
                role: { code: UserRole.ADMIN },
              },
            ],
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.createPasswordResetToken({
        email: '  ACTIVE@EXAMPLE.COM ',
        requestId: 'req-test-1',
        ipAddress: '198.51.100.10',
        userAgent: 'Mozilla/5.0',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.rawToken).toHaveLength(64); // 32 bytes hex
        expect(result.user.email).toBe('active@example.com');
        expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

        // Verify SHA-256 hash is stored, NEVER raw token
        const expectedHash = crypto.createHash('sha256').update(result.rawToken).digest('hex');
        expect(createdTokenData.tokenHash).toBe(expectedHash);
        expect(createdTokenData.tokenHash).not.toBe(result.rawToken);
        expect(createdTokenData.userId).toBe(VALID_USER_ID);

        // Verify previous tokens are invalidated
        expect(invalidatedWhere.userId).toBe(VALID_USER_ID);
        expect(invalidatedWhere.usedAt).toBeNull();

        // Verify audit log has no secrets or tokens
        expect(createdAuditData.eventKey).toBe(AuditEventKey.AUTH_PASSWORD_RESET_REQUESTED);
        expect(createdAuditData.targetId).toBe(VALID_USER_ID);
        expect(createdAuditData.result).toBe('SUCCESS');
        expect(JSON.stringify(createdAuditData)).not.toContain(result.rawToken);
        expect(JSON.stringify(createdAuditData)).not.toContain(expectedHash);
      }
    });
  });

  describe('resetPasswordWithToken', () => {
    it('rejects weak new passwords failing security policy', async () => {
      const mockPrisma: any = {};
      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: 'any-token',
        newPassword: 'short',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('WEAK_PASSWORD');
        expect(result.message).toContain('at least 12 characters');
      }
    });

    it('rejects missing or empty token', async () => {
      const mockPrisma: any = {};
      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: '   ',
        newPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_TOKEN');
      }
    });

    it('rejects non-existent token and logs failure audit', async () => {
      let createdAuditData: any = null;
      const mockPrisma: any = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditData = args.data;
            return Promise.resolve({ id: 'audit-02', ...args.data });
          }),
        },
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: 'nonexistent-token',
        newPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_TOKEN');
      }
      expect(createdAuditData.eventKey).toBe(AuditEventKey.AUTH_PASSWORD_RESET_FAILED);
      expect(createdAuditData.result).toBe('FAILURE');
      expect(createdAuditData.metadata.reason).toBe('TOKEN_NOT_FOUND');
    });

    it('rejects already used token and logs failure audit', async () => {
      let createdAuditData: any = null;
      const mockPrisma: any = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            usedAt: new Date(Date.now() - 60000), // Used 1 minute ago
            expiresAt: new Date(Date.now() + 600000),
            user: {
              id: VALID_USER_ID,
              accountStatus: AccountStatus.ACTIVE,
            },
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditData = args.data;
            return Promise.resolve({ id: 'audit-03', ...args.data });
          }),
        },
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: 'used-token',
        newPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('TOKEN_ALREADY_USED');
      }
      expect(createdAuditData.eventKey).toBe(AuditEventKey.AUTH_PASSWORD_RESET_FAILED);
      expect(createdAuditData.metadata.reason).toBe('TOKEN_ALREADY_USED');
    });

    it('rejects expired token and logs failure audit', async () => {
      let createdAuditData: any = null;
      const mockPrisma: any = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            usedAt: null,
            expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
            user: {
              id: VALID_USER_ID,
              accountStatus: AccountStatus.ACTIVE,
            },
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditData = args.data;
            return Promise.resolve({ id: 'audit-04', ...args.data });
          }),
        },
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: 'expired-token',
        newPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('TOKEN_EXPIRED');
      }
      expect(createdAuditData.eventKey).toBe(AuditEventKey.AUTH_PASSWORD_RESET_FAILED);
      expect(createdAuditData.metadata.reason).toBe('TOKEN_EXPIRED');
    });

    it('successfully resets password, invalidates tokens, revokes sessions transactionally, and logs audit', async () => {
      let updatedUserData: any = null;
      let consumedTokenId: any = null;
      let revokedUserId: any = null;
      let createdAuditData: any = null;

      const rawToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockTx: any = {
        user: {
          update: vi.fn().mockImplementation((args) => {
            updatedUserData = args.data;
            return Promise.resolve({
              id: VALID_USER_ID,
              fullName: 'Reset User',
              email: 'reset@example.com',
              username: 'resetuser',
              accountStatus: AccountStatus.ACTIVE,
              emailVerifiedAt: null,
              lastLoginAt: null,
              suspendedAt: null,
              deactivatedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: [
                {
                  id: 'ur-1',
                  userId: VALID_USER_ID,
                  roleId: 'role-1',
                  assignedByUserId: null,
                  assignedAt: new Date(),
                  revokedAt: null,
                  role: { code: UserRole.ADMIN },
                },
              ],
            });
          }),
        },
        passwordResetToken: {
          update: vi.fn().mockImplementation((args) => {
            consumedTokenId = args.where.id;
            return Promise.resolve({ id: args.where.id, usedAt: args.data.usedAt });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        session: {
          updateMany: vi.fn().mockImplementation((args) => {
            revokedUserId = args.where.userId;
            return Promise.resolve({ count: 3 }); // 3 sessions revoked
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditData = args.data;
            return Promise.resolve({ id: 'audit-05', ...args.data });
          }),
        },
      };

      const mockPrisma: any = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            tokenHash,
            userId: VALID_USER_ID,
            usedAt: null,
            expiresAt: new Date(Date.now() + 600000), // Valid for 10 more minutes
            user: {
              id: VALID_USER_ID,
              fullName: 'Reset User',
              email: 'reset@example.com',
              accountStatus: AccountStatus.ACTIVE,
              userRoles: [],
            },
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.resetPasswordWithToken({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword123!',
        requestId: 'req-reset-1',
        ipAddress: '198.51.100.20',
        userAgent: 'Playwright/Test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.revokedSessionsCount).toBe(3);
        expect(result.user.email).toBe('reset@example.com');

        // Verify passwordHash was updated with Argon2id hash
        expect(updatedUserData.passwordHash).toBeDefined();
        expect(updatedUserData.passwordHash).toContain('$argon2id$');

        // Verify current token was marked used
        expect(consumedTokenId).toBe(VALID_TOKEN_ID);

        // Verify sessions were revoked for user
        expect(revokedUserId).toBe(VALID_USER_ID);

        // Verify audit log
        expect(createdAuditData.eventKey).toBe(AuditEventKey.AUTH_PASSWORD_RESET_COMPLETED);
        expect(createdAuditData.targetId).toBe(VALID_USER_ID);
        expect(createdAuditData.result).toBe('SUCCESS');
        expect(createdAuditData.metadata.revokedSessionsCount).toBe(3);
        expect(JSON.stringify(createdAuditData)).not.toContain('BrandNewSecurePassword123!');
        expect(JSON.stringify(createdAuditData)).not.toContain(rawToken);
      }
    });

    it('successfully resets password for PENDING_APPROVAL user without changing or activating accountStatus', async () => {
      let updatedUserData: any = null;
      const rawToken = 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockTx: any = {
        user: {
          update: vi.fn().mockImplementation((args) => {
            updatedUserData = args.data;
            return Promise.resolve({
              id: VALID_USER_ID,
              fullName: 'Pending User',
              email: 'pending@example.com',
              username: 'pendinguser',
              accountStatus: AccountStatus.PENDING_APPROVAL, // Strictly preserved
              emailVerifiedAt: null,
              lastLoginAt: null,
              suspendedAt: null,
              deactivatedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: [],
            });
          }),
        },
        passwordResetToken: {
          update: vi.fn().mockResolvedValue({ id: VALID_TOKEN_ID, usedAt: new Date() }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        session: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-06' }),
        },
      };

      const mockPrisma: any = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            tokenHash,
            userId: VALID_USER_ID,
            usedAt: null,
            expiresAt: new Date(Date.now() + 600000),
            user: {
              id: VALID_USER_ID,
              fullName: 'Pending User',
              email: 'pending@example.com',
              accountStatus: AccountStatus.PENDING_APPROVAL,
              userRoles: [],
            },
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      };

      const repo = new UserRepository(mockPrisma);
      const result = await repo.resetPasswordWithToken({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword123!',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify accountStatus was NOT changed to ACTIVE
        expect(result.user.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);
        // Verify only passwordHash was modified
        expect(updatedUserData.passwordHash).toBeDefined();
        expect(updatedUserData.accountStatus).toBeUndefined();
      }
    });
  });
});
