import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { UserRepository } from '../src/user-repository';
import { AccountStatus, AuditEventKey, UserRole } from '@kebun-melon/contracts';
import { hashPassword } from '../src/password-service';

const VALID_USER_ID = '10000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '90000000-0000-0000-0000-000000000009';
const VALID_TOKEN_ID = '20000000-0000-0000-0000-000000000002';
const PLAIN_PASSWORD = 'CorrectSecurePassword123!';

describe('TASK-0216 Email Change Repository Unit & Concurrency Test Suite', () => {
  let validPasswordHash: string;

  beforeEach(async () => {
    validPasswordHash = await hashPassword(PLAIN_PASSWORD);
  });

  describe('requestEmailChange', () => {
    it('returns USER_NOT_FOUND when user does not exist', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'newemail@example.com',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('USER_NOT_FOUND');
      }
    });

    it('returns ACCOUNT_NOT_ACTIVE when user account is not active', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            fullName: 'Pending User',
            email: 'current@example.com',
            username: 'pending',
            passwordHash: validPasswordHash,
            accountStatus: AccountStatus.PENDING_APPROVAL,
            emailVerifiedAt: null,
            userRoles: [],
          }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'newemail@example.com',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ACCOUNT_NOT_ACTIVE');
      }
    });

    it('returns INVALID_CREDENTIALS when current password is incorrect or missing', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            fullName: 'Active User',
            email: 'current@example.com',
            username: 'active',
            passwordHash: validPasswordHash,
            accountStatus: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
          }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      // Wrong password
      const resultWrong = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'newemail@example.com',
        currentPassword: 'WrongPassword123!',
      });
      expect(resultWrong.success).toBe(false);
      if (!resultWrong.success) {
        expect(resultWrong.error).toBe('INVALID_CREDENTIALS');
      }

      // Empty password
      const resultEmpty = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'newemail@example.com',
        currentPassword: '',
      });
      expect(resultEmpty.success).toBe(false);
      if (!resultEmpty.success) {
        expect(resultEmpty.error).toBe('INVALID_CREDENTIALS');
      }
    });

    it('returns SAME_EMAIL when new email matches current email (case-insensitive & trimmed)', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            fullName: 'Active User',
            email: 'current@example.com',
            username: 'active',
            passwordHash: validPasswordHash,
            accountStatus: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
          }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: '  CURRENT@example.COM  ',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SAME_EMAIL');
      }
    });

    it('returns DUPLICATE_EMAIL when new email is already registered by another user', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockImplementation((args) => {
            if (args.where.id === VALID_USER_ID) {
              return Promise.resolve({
                id: VALID_USER_ID,
                fullName: 'Active User',
                email: 'current@example.com',
                username: 'active',
                passwordHash: validPasswordHash,
                accountStatus: AccountStatus.ACTIVE,
                emailVerifiedAt: new Date(),
                userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
              });
            }
            if (args.where.email === 'taken@example.com') {
              return Promise.resolve({ id: OTHER_USER_ID });
            }
            return Promise.resolve(null);
          }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'taken@example.com',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DUPLICATE_EMAIL');
      }
    });

    it('returns DUPLICATE_EMAIL when new email is already pending verification by another user', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockImplementation((args) => {
            if (args.where.id === VALID_USER_ID) {
              return Promise.resolve({
                id: VALID_USER_ID,
                fullName: 'Active User',
                email: 'current@example.com',
                username: 'active',
                passwordHash: validPasswordHash,
                accountStatus: AccountStatus.ACTIVE,
                emailVerifiedAt: new Date(),
                userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
              });
            }
            return Promise.resolve(null);
          }),
        },
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue({ id: 'pending-token-other-user' }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: 'pending-other@example.com',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DUPLICATE_EMAIL');
      }
    });

    it('successfully generates 6-digit code, scoped hash, and stages pendingEmail with 15-minute expiry', async () => {
      let createdToken: any = null;
      let deletedWhere: any = null;

      const mockTx: any = {
        emailVerificationToken: {
          deleteMany: vi.fn().mockImplementation((args) => {
            deletedWhere = args.where;
            return Promise.resolve({ count: 1 });
          }),
          create: vi.fn().mockImplementation((args) => {
            createdToken = args.data;
            return Promise.resolve({ id: VALID_TOKEN_ID, ...args.data });
          }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockImplementation((args) => {
            if (args.where.id === VALID_USER_ID) {
              return Promise.resolve({
                id: VALID_USER_ID,
                fullName: 'Active User',
                email: 'current@example.com',
                username: 'active',
                passwordHash: validPasswordHash,
                accountStatus: AccountStatus.ACTIVE,
                emailVerifiedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
              });
            }
            return Promise.resolve(null);
          }),
        },
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return await callback(mockTx);
        }),
      };

      const repo = new UserRepository(mockPrisma);
      const result = await repo.requestEmailChange({
        userId: VALID_USER_ID,
        newEmail: '  New.Valid@Example.Com  ',
        currentPassword: PLAIN_PASSWORD,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.code).toMatch(/^\d{6}$/);
        expect(result.pendingEmail).toBe('new.valid@example.com');
        expect(result.user.email).toBe('current@example.com'); // Current email remains authoritative!

        expect(deletedWhere).toEqual({ userId: VALID_USER_ID });
        expect(createdToken.userId).toBe(VALID_USER_ID);
        expect(createdToken.pendingEmail).toBe('new.valid@example.com');

        // Scoped hash check: sha256(userId:newEmail:code)
        const expectedHash = crypto
          .createHash('sha256')
          .update(`${VALID_USER_ID}:new.valid@example.com:${result.code}`)
          .digest('hex');
        expect(createdToken.tokenHash).toBe(expectedHash);

        // Expiry check: ~15 minutes in the future
        const now = Date.now();
        const expiryTime = result.expiresAt.getTime();
        expect(expiryTime - now).toBeGreaterThan(14 * 60 * 1000);
        expect(expiryTime - now).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
      }
    });
  });

  describe('verifyEmailChange', () => {
    it('returns NO_PENDING_EMAIL_CHANGE when no pending token exists', async () => {
      const mockTx: any = {
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code: '123456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NO_PENDING_EMAIL_CHANGE');
      }
    });

    it('returns TOKEN_EXPIRED and deletes token if code is expired', async () => {
      let deletedTokenId: string | null = null;
      const mockTx: any = {
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            pendingEmail: 'newemail@example.com',
            tokenHash: 'somehash',
            expiresAt: new Date(Date.now() - 1000), // Expired
          }),
          delete: vi.fn().mockImplementation((args) => {
            deletedTokenId = args.where.id;
            return Promise.resolve({});
          }),
        },
      };
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code: '123456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('TOKEN_EXPIRED');
        expect(deletedTokenId).toBe(VALID_TOKEN_ID);
      }
    });

    it('returns INVALID_VERIFICATION_CODE when code hash does not match', async () => {
      const code = '654321';
      const wrongCode = '111111';
      const pendingEmail = 'newemail@example.com';
      const tokenHash = crypto
        .createHash('sha256')
        .update(`${VALID_USER_ID}:${pendingEmail}:${code}`)
        .digest('hex');

      const mockTx: any = {
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            pendingEmail,
            tokenHash,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          }),
        },
      };
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code: wrongCode,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_VERIFICATION_CODE');
      }
    });

    it('atomic race check: returns DUPLICATE_EMAIL if another user took the email before verification', async () => {
      const code = '654321';
      const pendingEmail = 'target@example.com';
      const tokenHash = crypto
        .createHash('sha256')
        .update(`${VALID_USER_ID}:${pendingEmail}:${code}`)
        .digest('hex');

      const mockTx: any = {
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            pendingEmail,
            tokenHash,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          }),
          delete: vi.fn().mockResolvedValue({}),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: OTHER_USER_ID }), // Already taken by other user!
        },
      };
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DUPLICATE_EMAIL');
      }
    });

    it('successfully promotes email, updates emailVerifiedAt, deletes token, and records non-sensitive audit log', async () => {
      const code = '789102';
      const pendingEmail = 'promoted@example.com';
      const tokenHash = crypto
        .createHash('sha256')
        .update(`${VALID_USER_ID}:${pendingEmail}:${code}`)
        .digest('hex');

      let updatedUserData: any = null;
      let deletedTokenId: string | null = null;
      let createdAuditLog: any = null;

      const mockTx: any = {
        emailVerificationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: VALID_TOKEN_ID,
            userId: VALID_USER_ID,
            pendingEmail,
            tokenHash,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          }),
          delete: vi.fn().mockImplementation((args) => {
            deletedTokenId = args.where.id;
            return Promise.resolve({});
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null), // Uniqueness re-check passes
          update: vi.fn().mockImplementation((args) => {
            updatedUserData = args.data;
            return Promise.resolve({
              id: VALID_USER_ID,
              fullName: 'Active User',
              email: args.data.email,
              username: 'active',
              passwordHash: '',
              accountStatus: AccountStatus.ACTIVE,
              emailVerifiedAt: args.data.emailVerifiedAt,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: [{ revokedAt: null, role: { code: UserRole.ADMIN } }],
            });
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args) => {
            createdAuditLog = args.data;
            return Promise.resolve({ id: 'audit-log-1' });
          }),
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code,
        ipAddress: '198.51.100.20',
        userAgent: 'TestBrowser',
        requestId: 'req-test-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.email).toBe(pendingEmail);
        expect(result.user.email).toBe(pendingEmail);
        expect(result.emailVerifiedAt).toBeInstanceOf(Date);

        expect(deletedTokenId).toBe(VALID_TOKEN_ID);
        expect(updatedUserData.email).toBe(pendingEmail);
        expect(updatedUserData.emailVerifiedAt).toBeInstanceOf(Date);

        // Security / Audit Log verification: strictly non-sensitive metadata (no raw emails)
        expect(createdAuditLog.eventKey).toBe(AuditEventKey.ACCOUNT_EMAIL_CHANGED);
        expect(createdAuditLog.actorUserId).toBe(VALID_USER_ID);
        expect(createdAuditLog.targetType).toBe('USER');
        expect(createdAuditLog.targetId).toBe(VALID_USER_ID);
        expect(createdAuditLog.result).toBe('SUCCESS');
        expect(createdAuditLog.previousValues).toEqual({ emailChanged: true });
        expect(createdAuditLog.newValues).toEqual({ emailChanged: true });
        expect(createdAuditLog.metadata).toEqual({ action: 'EMAIL_CHANGE_VERIFIED' });

        // Ensure NO raw email appears anywhere in audit values or metadata
        const auditString = JSON.stringify(createdAuditLog);
        expect(auditString).not.toContain(pendingEmail);
        expect(auditString).not.toContain('current@example.com');
      }
    });

    it('handles Prisma P2034 write conflict with exponential backoff and returns CONCURRENCY_CONFLICT on exhaustion', async () => {
      let callCount = 0;
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_USER_ID,
            accountStatus: AccountStatus.ACTIVE,
          }),
        },
        $transaction: vi.fn().mockImplementation(async () => {
          callCount++;
          const error: any = new Error('Write conflict');
          error.code = 'P2034';
          throw error;
        }),
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.verifyEmailChange({
        userId: VALID_USER_ID,
        code: '123456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('CONCURRENCY_CONFLICT');
        expect(callCount).toBe(3); // Retried up to MAX_RETRIES = 3
      }
    });
  });
});
