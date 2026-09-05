import { describe, it, expect, vi } from 'vitest';
import {
  hashSessionToken,
  loginUser,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  ActiveSessionExistsError,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_LAST_SEEN_THROTTLE_MS,
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
} from '../src/session-service';
import { hashPassword } from '../src/password-service';
import { AccountStatus } from '@kebun-melon/contracts';

describe('Session Service Unit Tests', () => {
  it('1. Token hashing produces a 64-character SHA-256 hex digest', () => {
    const rawToken = '0123456789abcdef0123456789abcdef';
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawToken);
  });

  it('2. Constants match security specifications', () => {
    expect(SESSION_COOKIE_NAME).toBe('session_token');
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000); // 30 mins
    expect(SESSION_LAST_SEEN_THROTTLE_MS).toBe(60 * 1000); // 1 min
    expect(SESSION_ABSOLUTE_LIFETIME_MS).toBe(8 * 60 * 60 * 1000); // 8 hours
    expect(SESSION_ABSOLUTE_LIFETIME_SECONDS).toBe(8 * 60 * 60); // 8 hours (28800s)
  });

  it('3. Error classes instantiate with expected messages and codes', () => {
    const credErr = new InvalidCredentialsError();
    expect(credErr.message).toBe('Invalid email or password.');
    expect(credErr.name).toBe('InvalidCredentialsError');

    const pendingErr = new AccountStatusForbiddenError(AccountStatus.PENDING_APPROVAL);
    expect(pendingErr.status).toBe(AccountStatus.PENDING_APPROVAL);
    expect(pendingErr.message).toContain('PENDING_APPROVAL');

    const suspendedErr = new AccountStatusForbiddenError(AccountStatus.SUSPENDED);
    expect(suspendedErr.status).toBe(AccountStatus.SUSPENDED);
    expect(suspendedErr.message).toContain('SUSPENDED');

    const sessionExistsErr = new ActiveSessionExistsError();
    expect(sessionExistsErr.message).toContain('active session already exists');
    expect(sessionExistsErr.name).toBe('ActiveSessionExistsError');
  });

  it('4. loginUser rotates session when existingToken matches active session hash', async () => {
    const rawExistingToken = 'existing-raw-token-12345678901234';
    const existingHash = hashSessionToken(rawExistingToken);
    const mockHash = await hashPassword('ValidPassword123!');

    const mockUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'rotate.user@example.com',
      fullName: 'Rotate User',
      passwordHash: mockHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
    };

    const mockActiveSession = {
      id: 'session-old-1',
      sessionTokenHash: existingHash,
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
      lastSeenAt: new Date(),
      revokedAt: null,
    };

    const updatedSessions: any[] = [];
    const createdSessions: any[] = [];

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      session: {
        updateMany: vi.fn().mockImplementation((args) => {
          updatedSessions.push(args);
          return { count: 1 };
        }),
        findMany: vi.fn().mockResolvedValue([mockActiveSession]),
        findFirst: vi.fn().mockResolvedValue(mockActiveSession),
        create: vi.fn().mockImplementation((args) => {
          createdSessions.push(args.data);
          return args.data;
        }),
      },
      user: {
        update: vi.fn().mockResolvedValue(mockUser),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const mockPrisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    const result = await loginUser(
      mockPrisma,
      { email: 'rotate.user@example.com', password: 'ValidPassword123!' },
      { existingToken: rawExistingToken }
    );

    expect(result.rawToken).toBeDefined();
    expect(result.user.email).toBe('rotate.user@example.com');
    // Verify old session was revoked via updateMany
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: mockUser.id, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
    // Verify new session was created
    expect(createdSessions.length).toBe(1);
    expect(createdSessions[0].userId).toBe(mockUser.id);
  });

  it('5. loginUser rejects with ActiveSessionExistsError when a different device attempts concurrent login', async () => {
    const activeHash = hashSessionToken('active-token-on-browser-a');
    const mockHash = await hashPassword('ValidPassword123!');

    const mockUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'reject.user@example.com',
      fullName: 'Reject User',
      passwordHash: mockHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
    };

    const mockActiveSession = {
      id: 'session-browser-a',
      sessionTokenHash: activeHash,
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
      lastSeenAt: new Date(),
      revokedAt: null,
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    };

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      session: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([mockActiveSession]),
        findFirst: vi.fn().mockResolvedValue(mockActiveSession),
      },
    };

    const mockPrisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    // Case 5a: Different device (mobile UA on same IP or different IP) without existingToken
    await expect(
      loginUser(
        mockPrisma,
        { email: 'reject.user@example.com', password: 'ValidPassword123!' },
        {
          ipAddress: '192.168.1.50',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
        }
      )
    ).rejects.toThrow(ActiveSessionExistsError);

    // Case 5b: Different IP with same UA without existingToken
    await expect(
      loginUser(
        mockPrisma,
        { email: 'reject.user@example.com', password: 'ValidPassword123!' },
        {
          ipAddress: '10.0.0.99',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
        }
      )
    ).rejects.toThrow(ActiveSessionExistsError);

    // Case 5c: Different existingToken and mismatched environment
    mockTx.session.findFirst.mockResolvedValueOnce(null); // previousToken check

    await expect(
      loginUser(
        mockPrisma,
        { email: 'reject.user@example.com', password: 'ValidPassword123!' },
        {
          existingToken: 'mismatched-other-token',
          ipAddress: '10.0.0.99',
          userAgent: 'Unknown',
        }
      )
    ).rejects.toThrow(ActiveSessionExistsError);
  });

  it('6. loginUser allows login and auto-prunes when previous session was idle (>30m) or expired (>8h)', async () => {
    const mockHash = await hashPassword('ValidPassword123!');

    const mockUser = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'expired.user@example.com',
      fullName: 'Expired User',
      passwordHash: mockHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
    };

    const mockExpiredSession = {
      id: 'session-old-expired',
      sessionTokenHash: hashSessionToken('expired-token'),
      userId: mockUser.id,
      expiresAt: new Date(Date.now() - 3600000), // expired 1h ago
      lastSeenAt: new Date(Date.now() - 3600000), // idle 1h ago
      revokedAt: null,
    };

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      session: {
        findMany: vi.fn().mockResolvedValue([mockExpiredSession]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockImplementation((args) => args.data),
      },
      user: {
        update: vi.fn().mockResolvedValue(mockUser),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-2' }),
      },
    };

    const mockPrisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    // New login succeeds without throwing ActiveSessionExistsError even without existingToken
    const result = await loginUser(
      mockPrisma,
      { email: 'expired.user@example.com', password: 'ValidPassword123!' },
      {}
    );

    expect(result.rawToken).toBeDefined();
    expect(result.user.email).toBe('expired.user@example.com');
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: mockUser.id, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
    expect(mockTx.session.create).toHaveBeenCalled();
  });

  it('7. loginUser allows same-client session recovery when cookie is lost/cleared but IP and User-Agent match', async () => {
    const mockHash = await hashPassword('ValidPassword123!');

    const mockUser = {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'recovery.user@example.com',
      fullName: 'Recovery User',
      passwordHash: mockHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
    };

    const mockActiveSession = {
      id: 'session-recovery-1',
      sessionTokenHash: hashSessionToken('lost-token-on-browser'),
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
      lastSeenAt: new Date(),
      revokedAt: null,
      ipAddress: '203.0.113.195',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    const updatedSessions: any[] = [];
    const createdSessions: any[] = [];

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      session: {
        updateMany: vi.fn().mockImplementation((args) => {
          updatedSessions.push(args);
          return { count: 1 };
        }),
        findMany: vi.fn().mockResolvedValue([mockActiveSession]),
        findFirst: vi.fn().mockResolvedValue(mockActiveSession),
        create: vi.fn().mockImplementation((args) => {
          createdSessions.push(args.data);
          return args.data;
        }),
      },
      user: {
        update: vi.fn().mockResolvedValue(mockUser),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-recovery' }),
      },
    };

    const mockPrisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    // Request arrives with NO existingToken (lost/deleted cookie), but identical IP and User-Agent
    const result = await loginUser(
      mockPrisma,
      { email: 'recovery.user@example.com', password: 'ValidPassword123!' },
      {
        ipAddress: '203.0.113.195',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    );

    expect(result.rawToken).toBeDefined();
    expect(result.user.email).toBe('recovery.user@example.com');
    // Old session should be revoked
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: mockUser.id, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
    // New session created
    expect(createdSessions.length).toBe(1);
    expect(createdSessions[0].userId).toBe(mockUser.id);
  });

  it('8. loginUser allows same-client session recovery when previous session token for this user is provided', async () => {
    const mockHash = await hashPassword('ValidPassword123!');
    const previousToken = 'previous-valid-session-token-user-1';
    const previousTokenHash = hashSessionToken(previousToken);

    const mockUser = {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'prev.token@example.com',
      fullName: 'Prev Token User',
      passwordHash: mockHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ revokedAt: null, role: { code: 'ADMIN' } }],
    };

    const mockActiveSession = {
      id: 'session-active-different-hash',
      sessionTokenHash: hashSessionToken('active-token-hash-xyz'),
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
      lastSeenAt: new Date(),
      revokedAt: null,
      ipAddress: '10.0.0.1',
      userAgent: 'Unknown UA',
    };

    const mockPreviousSession = {
      id: 'session-prev-1',
      sessionTokenHash: previousTokenHash,
      userId: mockUser.id,
      expiresAt: new Date(Date.now() - 3600000),
      revokedAt: new Date(Date.now() - 3600000),
    };

    const updatedSessions: any[] = [];
    const createdSessions: any[] = [];

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      session: {
        updateMany: vi.fn().mockImplementation((args) => {
          updatedSessions.push(args);
          return { count: 1 };
        }),
        findMany: vi.fn().mockResolvedValue([mockActiveSession]),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(mockActiveSession) // active check
          .mockResolvedValueOnce(mockPreviousSession), // previousToken check
        create: vi.fn().mockImplementation((args) => {
          createdSessions.push(args.data);
          return args.data;
        }),
      },
      user: {
        update: vi.fn().mockResolvedValue(mockUser),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-prev' }),
      },
    };

    const mockPrisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    const result = await loginUser(
      mockPrisma,
      { email: 'prev.token@example.com', password: 'ValidPassword123!' },
      { existingToken: previousToken }
    );

    expect(result.rawToken).toBeDefined();
    expect(result.user.email).toBe('prev.token@example.com');
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: mockUser.id, revokedAt: null },
      })
    );
    expect(createdSessions.length).toBe(1);
  });
});
