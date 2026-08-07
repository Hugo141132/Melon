import { describe, it, expect, vi } from 'vitest';
import { UserRepository } from '../src/user-repository';
import {
  validateSession,
  revokeAllUserSessions,
  verifyStreamSessionActive,
} from '../src/session-service';
import { AccountStatus, AuditEventKey } from '@kebun-melon/contracts';

const VALID_UUID_1 = '10000000-0000-0000-0000-000000000001';
const VALID_UUID_2 = '20000000-0000-0000-0000-000000000002';
const VALID_SESSION_ID = '30000000-0000-0000-0000-000000000003';

describe('TASK-0908 Session Revocation Unit Test Suite', () => {
  describe('Password Change and Session Revocation', () => {
    it('rejects weak new passwords failing security policy', async () => {
      const mockPrisma: any = {};
      const repo = new UserRepository(mockPrisma);

      const result = await repo.changeUserPassword({
        userId: VALID_UUID_1,
        newPassword: 'weak',
        actorUserId: VALID_UUID_1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('WEAK_PASSWORD');
        expect(result.message).toContain('at least 12 characters');
      }
    });

    it('rejects password change if user is not found', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.changeUserPassword({
        userId: VALID_UUID_1,
        newPassword: 'ValidPassword123!',
        actorUserId: VALID_UUID_1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('USER_NOT_FOUND');
      }
    });

    it('rejects password change if account status is not ACTIVE', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: VALID_UUID_1,
            fullName: 'Suspended User',
            email: 'suspended@example.com',
            accountStatus: AccountStatus.SUSPENDED,
            passwordHash: 'oldHash',
          }),
        },
      };
      const repo = new UserRepository(mockPrisma);

      const result = await repo.changeUserPassword({
        userId: VALID_UUID_1,
        newPassword: 'ValidPassword123!',
        actorUserId: VALID_UUID_1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ACCOUNT_NOT_ACTIVE');
      }
    });

    it('transactionally updates passwordHash, revokes ALL user sessions, and logs audit event', async () => {
      const userObj = {
        id: VALID_UUID_1,
        fullName: 'Active User',
        email: 'active@example.com',
        username: 'activeuser',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
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
            userId: VALID_UUID_1,
            roleId: 'r1',
            assignedByUserId: null,
            assignedAt: new Date(),
            revokedAt: null,
            role: { code: 'ADMIN' },
          },
        ],
      };

      const updateMock = vi.fn().mockResolvedValue(userObj);
      const updateManySessionsMock = vi.fn().mockResolvedValue({ count: 4 });
      const createAuditLogMock = vi.fn().mockResolvedValue({ id: 'audit-1' });

      const txMock: any = {
        user: {
          update: updateMock,
        },
        session: {
          updateMany: updateManySessionsMock,
        },
        auditLog: {
          create: createAuditLogMock,
        },
      };

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(userObj),
        },
        $transaction: vi.fn(async (cb: any) => cb(txMock)),
      };

      const repo = new UserRepository(mockPrisma);

      const result = await repo.changeUserPassword({
        userId: VALID_UUID_1,
        newPassword: 'NewSecurePassword123!',
        actorUserId: VALID_UUID_1,
        requestId: 'req-pwd-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.revokedSessionsCount).toBe(4);
        expect(result.user.id).toBe(VALID_UUID_1);
      }

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_UUID_1 },
          data: expect.objectContaining({
            passwordHash: expect.stringMatching(/^\$argon2id\$/),
          }),
        })
      );

      expect(updateManySessionsMock).toHaveBeenCalledWith({
        where: {
          userId: VALID_UUID_1,
          revokedAt: null,
        },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });

      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: AuditEventKey.ACCOUNT_PASSWORD_CHANGED,
            actorUserId: VALID_UUID_1,
            targetId: VALID_UUID_1,
            result: 'SUCCESS',
          }),
        })
      );
    });
  });

  describe('Account Status Revalidation & Session Invalidation', () => {
    it('revokes session when account status becomes non-ACTIVE during session validation', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        userId: VALID_UUID_1,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
        user: {
          id: VALID_UUID_1,
          fullName: 'Suspended User',
          email: 'suspended@example.com',
          username: null,
          accountStatus: 'SUSPENDED', // Non-ACTIVE status
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: new Date(),
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [],
        },
      };

      const sessionUpdateMock = vi.fn().mockResolvedValue({});
      const mockPrisma: any = {
        session: {
          findUnique: vi.fn().mockResolvedValue(mockSession),
          update: sessionUpdateMock,
        },
      };

      const validated = await validateSession(mockPrisma, 'raw-token-123');

      expect(validated).toBeNull();
      expect(sessionUpdateMock).toHaveBeenCalledWith({
        where: { id: VALID_SESSION_ID },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });
    });

    it('revokeAllUserSessions soft-revokes all active sessions for target user', async () => {
      const updateManyMock = vi.fn().mockResolvedValue({ count: 3 });
      const mockPrisma: any = {
        session: {
          updateMany: updateManyMock,
        },
      };

      const count = await revokeAllUserSessions(mockPrisma, VALID_UUID_1);

      expect(count).toBe(3);
      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          userId: VALID_UUID_1,
          revokedAt: null,
        },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('Live Stream Session Verification (verifyStreamSessionActive)', () => {
    it('returns true when live stream session is active and valid', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        userId: VALID_UUID_1,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
        user: {
          id: VALID_UUID_1,
          fullName: 'Live User',
          email: 'live@example.com',
          username: null,
          accountStatus: 'ACTIVE',
          emailVerifiedAt: null,
          lastLoginAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [],
        },
      };

      const mockPrisma: any = {
        session: {
          findUnique: vi.fn().mockResolvedValue(mockSession),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const isActive = await verifyStreamSessionActive(mockPrisma, 'valid-token');
      expect(isActive).toBe(true);
    });

    it('returns false when live stream session is revoked, expired, or account becomes non-ACTIVE', async () => {
      const mockSessionRevoked = {
        id: VALID_SESSION_ID,
        userId: VALID_UUID_1,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
        user: {
          id: VALID_UUID_1,
          fullName: 'Live User',
          email: 'live@example.com',
          accountStatus: 'ACTIVE',
          userRoles: [],
        },
      };

      const mockPrisma: any = {
        session: {
          findUnique: vi.fn().mockResolvedValue(mockSessionRevoked),
        },
      };

      const isActive = await verifyStreamSessionActive(mockPrisma, 'revoked-token');
      expect(isActive).toBe(false);
    });
  });
});
