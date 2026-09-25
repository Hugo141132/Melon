import { describe, it, expect, vi } from 'vitest';
import {
  hashRecoveryOtp,
  createSessionRecoveryChallenge,
  verifySessionRecoveryChallenge,
  ExpiredRecoveryOtpError,
  InvalidRecoveryOtpError,
  MaxRecoveryAttemptsExceededError,
  ChallengeNotFoundError,
  NoActiveSessionToRecoverError,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
} from '../src/session-service';
import { hashPassword } from '../src/password-service';
import { AccountStatus } from '@kebun-melon/contracts';

describe('TASK-0218 Session Recovery Flow Unit Tests', () => {
  it('1. hashRecoveryOtp creates consistent SHA-256 salted hash', () => {
    const challengeId = '11111111-1111-1111-1111-111111111111';
    const otp = '123456';
    const hash1 = hashRecoveryOtp(challengeId, otp);
    const hash2 = hashRecoveryOtp(challengeId, otp);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(otp);

    // Salting with challengeId ensures different challenge gets different hash
    const otherHash = hashRecoveryOtp('22222222-2222-2222-2222-222222222222', otp);
    expect(hash1).not.toBe(otherHash);
  });

  it('2. createSessionRecoveryChallenge rejects invalid credentials', async () => {
    const mockHash = await hashPassword('CorrectPassword123!');
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          passwordHash: mockHash,
          accountStatus: AccountStatus.ACTIVE,
          userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
        }),
      },
    } as any;

    await expect(
      createSessionRecoveryChallenge(mockPrisma, {
        email: 'user@example.com',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('3. createSessionRecoveryChallenge rejects when no active session exists to recover', async () => {
    const mockHash = await hashPassword('CorrectPassword123!');
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          passwordHash: mockHash,
          accountStatus: AccountStatus.ACTIVE,
          userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
        }),
      },
      session: {
        findFirst: vi.fn().mockResolvedValue(null), // No active session
      },
    } as any;

    await expect(
      createSessionRecoveryChallenge(mockPrisma, {
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      })
    ).rejects.toThrow(NoActiveSessionToRecoverError);
  });

  it('4. createSessionRecoveryChallenge generates 6-digit OTP, 60s expiry, and records challenge', async () => {
    const mockHash = await hashPassword('CorrectPassword123!');
    let createdChallenge: any = null;

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'user@example.com',
          fullName: 'Test User',
          passwordHash: mockHash,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
        }),
      },
      session: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-session',
          userId: '11111111-1111-1111-1111-111111111111',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 100000),
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          sessionRecoveryChallenge: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockImplementation((args) => {
              createdChallenge = args.data;
              return args.data;
            }),
          },
        };
        return callback(tx);
      }),
    } as any;

    const result = await createSessionRecoveryChallenge(mockPrisma, {
      email: 'user@example.com',
      password: 'CorrectPassword123!',
    });

    expect(result.challengeId).toBeDefined();
    expect(result.rawOtp).toMatch(/^\d{6}$/);
    expect(result.expiresInSeconds).toBe(60);
    expect(createdChallenge).toBeDefined();
    expect(createdChallenge.otpHash).toHaveLength(64);
    // Stored hash is NOT plaintext OTP
    expect(createdChallenge.otpHash).not.toBe(result.rawOtp);
    expect(createdChallenge.maxAttempts).toBe(3);
    expect(createdChallenge.attempts).toBe(0);
  });

  it('5. verifySessionRecoveryChallenge rejects expired OTP challenge', async () => {
    const challengeId = '11111111-1111-1111-1111-111111111111';
    const otp = '654321';
    const otpHash = hashRecoveryOtp(challengeId, otp);

    const mockPrisma = {
      sessionRecoveryChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          id: challengeId,
          userId: 'user-1',
          otpHash,
          expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
          maxAttempts: 3,
          attempts: 0,
          consumedAt: null,
          user: {
            id: 'user-1',
            accountStatus: AccountStatus.ACTIVE,
            userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
          },
        }),
      },
    } as any;

    await expect(
      verifySessionRecoveryChallenge(mockPrisma, {
        challengeId,
        otp,
      })
    ).rejects.toThrow(ExpiredRecoveryOtpError);
  });

  it('6. verifySessionRecoveryChallenge tracks invalid attempts and locks after 3 failures', async () => {
    const challengeId = '11111111-1111-1111-1111-111111111111';
    const validOtp = '123456';
    const wrongOtp = '999999';
    const otpHash = hashRecoveryOtp(challengeId, validOtp);

    let updatedAttempts = 0;
    let isConsumed = false;

    // First failed attempt (attempts = 0 -> 1)
    const mockPrisma1 = {
      sessionRecoveryChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          id: challengeId,
          userId: 'user-1',
          otpHash,
          expiresAt: new Date(Date.now() + 30000),
          maxAttempts: 3,
          attempts: 0,
          consumedAt: null,
          user: {
            id: 'user-1',
            accountStatus: AccountStatus.ACTIVE,
            userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
          },
        }),
        update: vi.fn().mockImplementation((args) => {
          updatedAttempts = args.data.attempts;
        }),
      },
    } as any;

    await expect(
      verifySessionRecoveryChallenge(mockPrisma1, {
        challengeId,
        otp: wrongOtp,
      })
    ).rejects.toThrow(InvalidRecoveryOtpError);
    expect(updatedAttempts).toBe(1);

    // Third failed attempt (attempts = 2 -> 3)
    const mockPrisma3 = {
      sessionRecoveryChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          id: challengeId,
          userId: 'user-1',
          otpHash,
          expiresAt: new Date(Date.now() + 30000),
          maxAttempts: 3,
          attempts: 2,
          consumedAt: null,
          user: {
            id: 'user-1',
            accountStatus: AccountStatus.ACTIVE,
            userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
          },
        }),
        update: vi.fn().mockImplementation((args) => {
          updatedAttempts = args.data.attempts;
          if (args.data.consumedAt) isConsumed = true;
        }),
      },
    } as any;

    await expect(
      verifySessionRecoveryChallenge(mockPrisma3, {
        challengeId,
        otp: wrongOtp,
      })
    ).rejects.toThrow(MaxRecoveryAttemptsExceededError);
    expect(updatedAttempts).toBe(3);
    expect(isConsumed).toBe(true);
  });

  it('7. verifySessionRecoveryChallenge revokes previous active sessions and creates exactly one new session on success', async () => {
    const challengeId = '11111111-1111-1111-1111-111111111111';
    const otp = '888888';
    const otpHash = hashRecoveryOtp(challengeId, otp);

    let revokedCount = 0;
    let createdSession: any = null;
    let auditLogCreated: any = null;

    const mockUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'owner@example.com',
      fullName: 'Owner User',
      accountStatus: AccountStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'OWNER' } }],
    };

    const mockPrisma = {
      sessionRecoveryChallenge: {
        findUnique: vi.fn().mockResolvedValue({
          id: challengeId,
          userId: mockUser.id,
          otpHash,
          expiresAt: new Date(Date.now() + 45000),
          maxAttempts: 3,
          attempts: 0,
          consumedAt: null,
          user: mockUser,
        }),
      },
      user: {
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
          sessionRecoveryChallenge: {
            update: vi.fn().mockResolvedValue({ id: challengeId }),
          },
          session: {
            updateMany: vi.fn().mockImplementation((args) => {
              revokedCount++;
              return { count: 1 };
            }),
            create: vi.fn().mockImplementation((args) => {
              createdSession = args.data;
              return args.data;
            }),
          },
          auditLog: {
            create: vi.fn().mockImplementation((args) => {
              auditLogCreated = args.data;
              return args.data;
            }),
          },
        };
        return callback(tx);
      }),
    } as any;

    const result = await verifySessionRecoveryChallenge(
      mockPrisma,
      {
        challengeId,
        otp,
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'TestBrowser/1.0',
        requestId: 'req-recovery-123',
      }
    );

    expect(result.rawToken).toHaveLength(64);
    expect(result.user.email).toBe('owner@example.com');
    expect(revokedCount).toBe(1);
    expect(createdSession).toBeDefined();
    expect(createdSession.sessionTokenHash).toBeDefined();
    expect(auditLogCreated).toBeDefined();
    expect(auditLogCreated.eventKey).toBe('auth.session.force_recovered');
    expect(auditLogCreated.result).toBe('SUCCESS');
    expect(auditLogCreated.metadata.recoveryMethod).toBe('EMAIL_OTP');
  });
});
