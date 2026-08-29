import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loginUser,
  validateSession,
  revokeSession,
  hashSessionToken,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  ActiveSessionExistsError,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ABSOLUTE_LIFETIME_MS,
} from '../src/session-service';
import { validateTestDatabaseUrl } from '../src/owner-provisioning';
import { seedRBAC } from '../prisma/seed';
import { hashPassword } from '../src/password-service';

describe('TASK-0204 Login and Session Management Integration Test Suite', () => {
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!testDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL environment variable is required to run integration tests.\n' +
        'Example: TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/kebun_melon_disposable_test"\n' +
        'Or run: npm run db:test:session-integration:docker'
    );
  }

  validateTestDatabaseUrl(testDbUrl);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: testDbUrl },
    },
  });

  let isConnected = false;

  async function cleanDatabase() {
    if (!isConnected) return;
    await prisma.faucetCommandEvent.deleteMany();
    await prisma.faucetCommand.deleteMany();
    await prisma.userDeviceAccess.deleteMany();
    await prisma.alertAcknowledgement.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.accountApproval.deleteMany();
    await prisma.userRoleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userPreference.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
  }

  beforeAll(async () => {
    try {
      await prisma.$connect();
      isConnected = true;
    } catch (error: any) {
      isConnected = false;
      throw new Error(
        `Failed to connect to test database at '${testDbUrl}'.\n` +
          `Please verify PostgreSQL server is running and reachable: ${error.message}`
      );
    }
  });

  afterAll(async () => {
    if (isConnected) {
      try {
        await cleanDatabase();
      } catch {
        // Ignore cleanup errors on tear down
      }
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await cleanDatabase();
    await seedRBAC(prisma);
  });

  async function createTestUser(
    email: string,
    accountStatus: AccountStatus,
    roleCode: UserRole = UserRole.ADMIN
  ) {
    const passwordHash = await hashPassword('ValidPassword123!');

    const user = await prisma.user.create({
      data: {
        fullName: 'Test User',
        email,
        passwordHash,
        accountStatus,
      },
    });

    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (role) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }

    return user;
  }

  it('1. Valid ACTIVE login returns raw token and safe DTO, stores token hash only, updates lastLoginAt, creates audit record without secrets', async () => {
    const user = await createTestUser('active.user@example.com', AccountStatus.ACTIVE);

    const result = await loginUser(
      prisma,
      {
        email: '  ACTIVE.USER@EXAMPLE.COM ',
        password: 'ValidPassword123!',
      },
      { ipAddress: '127.0.0.1', userAgent: 'IntegrationTest' }
    );

    expect(result.rawToken).toBeDefined();
    expect(result.rawToken).toHaveLength(64);
    expect(result.user.id).toBe(user.id);
    expect(result.user.accountStatus).toBe(AccountStatus.ACTIVE);

    // Verify session table in DB: contains hashed token, NOT raw token
    const tokenHash = hashSessionToken(result.rawToken);
    const dbSession = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
    });

    expect(dbSession).not.toBeNull();
    expect(dbSession?.userId).toBe(user.id);
    expect(dbSession?.revokedAt).toBeNull();

    // Raw token is nowhere in DB
    const allSessions = await prisma.session.findMany();
    for (const s of allSessions) {
      expect(s.sessionTokenHash).not.toBe(result.rawToken);
    }

    // Verify user lastLoginAt updated
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.lastLoginAt).not.toBeNull();

    // Verify AuditLog secrecy
    const auditLog = await prisma.auditLog.findFirst({
      where: { eventKey: 'auth.login.success', actorUserId: user.id },
    });
    expect(auditLog).not.toBeNull();
    const auditString = JSON.stringify(auditLog);
    expect(auditString).not.toContain('ValidPassword123!');
    expect(auditString).not.toContain(result.rawToken);
    expect(auditString).not.toContain(tokenHash);
  });

  it('2. Invalid email or wrong password throws generic InvalidCredentialsError (no account enumeration)', async () => {
    await createTestUser('user@example.com', AccountStatus.ACTIVE);

    // Non-existent email
    await expect(
      loginUser(prisma, { email: 'nonexistent@example.com', password: 'ValidPassword123!' })
    ).rejects.toThrow(InvalidCredentialsError);

    // Existing email, wrong password
    await expect(
      loginUser(prisma, { email: 'user@example.com', password: 'WrongPassword123!' })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('3. Non-ACTIVE accounts are rejected with AccountStatusForbiddenError', async () => {
    await createTestUser('pending@example.com', AccountStatus.PENDING_APPROVAL);
    await createTestUser('suspended@example.com', AccountStatus.SUSPENDED);
    await createTestUser('deactivated@example.com', AccountStatus.DEACTIVATED);
    await createTestUser('rejected@example.com', AccountStatus.REJECTED);

    await expect(
      loginUser(prisma, { email: 'pending@example.com', password: 'ValidPassword123!' })
    ).rejects.toThrow(AccountStatusForbiddenError);

    await expect(
      loginUser(prisma, { email: 'suspended@example.com', password: 'ValidPassword123!' })
    ).rejects.toThrow(AccountStatusForbiddenError);

    await expect(
      loginUser(prisma, { email: 'deactivated@example.com', password: 'ValidPassword123!' })
    ).rejects.toThrow(AccountStatusForbiddenError);

    await expect(
      loginUser(prisma, { email: 'rejected@example.com', password: 'ValidPassword123!' })
    ).rejects.toThrow(AccountStatusForbiddenError);
  });

  it('4. Session lookup enforces 30-min idle and 8-hour absolute timeouts', async () => {
    await createTestUser('session.user@example.com', AccountStatus.ACTIVE);

    const loginRes = await loginUser(prisma, {
      email: 'session.user@example.com',
      password: 'ValidPassword123!',
    });

    const tokenHash = hashSessionToken(loginRes.rawToken);

    // Valid lookup
    const valid = await validateSession(prisma, loginRes.rawToken);
    expect(valid).not.toBeNull();
    expect(valid?.user.id).toBe(loginRes.user.id);

    // Mock 31 mins idle
    const idleDate = new Date(Date.now() - (SESSION_IDLE_TIMEOUT_MS + 60000));
    await prisma.session.update({
      where: { sessionTokenHash: tokenHash },
      data: { lastSeenAt: idleDate },
    });

    const idleExpired = await validateSession(prisma, loginRes.rawToken);
    expect(idleExpired).toBeNull();

    // Verify session soft-revoked in DB
    const dbIdleSession = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
    });
    expect(dbIdleSession?.revokedAt).not.toBeNull();

    // Create a new session for 8-hour absolute test
    const loginRes2 = await loginUser(prisma, {
      email: 'session.user@example.com',
      password: 'ValidPassword123!',
    });
    const tokenHash2 = hashSessionToken(loginRes2.rawToken);

    // Mock absolute expiry in past
    const pastExpires = new Date(Date.now() - 1000);
    await prisma.session.update({
      where: { sessionTokenHash: tokenHash2 },
      data: { expiresAt: pastExpires },
    });

    const absExpired = await validateSession(prisma, loginRes2.rawToken);
    expect(absExpired).toBeNull();
  });

  it('5. Account status changes to non-ACTIVE immediately invalidate sessions upon lookup', async () => {
    const user = await createTestUser('changing@example.com', AccountStatus.ACTIVE);

    const loginRes = await loginUser(prisma, {
      email: 'changing@example.com',
      password: 'ValidPassword123!',
    });

    // Verify valid initial session
    const initialSession = await validateSession(prisma, loginRes.rawToken);
    expect(initialSession).not.toBeNull();

    // Suspend user in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: AccountStatus.SUSPENDED },
    });

    // Lookup session after status change
    const afterSuspend = await validateSession(prisma, loginRes.rawToken);
    expect(afterSuspend).toBeNull();

    // Session is soft-revoked in DB
    const tokenHash = hashSessionToken(loginRes.rawToken);
    const dbSession = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
    });
    expect(dbSession?.revokedAt).not.toBeNull();
  });

  it('6. Logout revokes session and creates audit log, and is safe & idempotent when repeated', async () => {
    const user = await createTestUser('logout@example.com', AccountStatus.ACTIVE);

    const loginRes = await loginUser(prisma, {
      email: 'logout@example.com',
      password: 'ValidPassword123!',
    });

    // First logout
    const revoked = await revokeSession(prisma, loginRes.rawToken);
    expect(revoked).toBe(true);

    const tokenHash = hashSessionToken(loginRes.rawToken);
    const dbSession = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
    });
    expect(dbSession?.revokedAt).not.toBeNull();

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { eventKey: 'auth.logout', actorUserId: user.id },
    });
    expect(audit).not.toBeNull();

    // Second logout (idempotent, returns false, does not throw)
    const repeatRevoke = await revokeSession(prisma, loginRes.rawToken);
    expect(repeatRevoke).toBe(false);

    // Random non-existent token logout (safe, returns false)
    const invalidRevoke = await revokeSession(prisma, 'nonexistenttoken');
    expect(invalidRevoke).toBe(false);
  });
  it('7. Simultaneous concurrent login attempts for the same user atomically allow exactly one session and reject the other with ActiveSessionExistsError', async () => {
    const user = await createTestUser('concurrent.user@example.com', AccountStatus.ACTIVE);

    // Trigger two simultaneous logins for the same user concurrently
    const [resA, resB] = await Promise.allSettled([
      loginUser(prisma, {
        email: 'concurrent.user@example.com',
        password: 'ValidPassword123!',
      }),
      loginUser(prisma, {
        email: 'concurrent.user@example.com',
        password: 'ValidPassword123!',
      }),
    ]);

    // Exactly one must succeed, and exactly one must fail with ActiveSessionExistsError
    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const successfulResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    expect(successfulResult.rawToken).toBeDefined();

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError.name).toBe('ActiveSessionExistsError');

    // Verify in database: exactly ONE active (non-revoked) session exists
    const activeSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });
    expect(activeSessions).toHaveLength(1);
  });

  it('8. Existing active session is preserved when a conflicting login attempt is rejected', async () => {
    const user = await createTestUser('preserve.user@example.com', AccountStatus.ACTIVE);

    // Initial valid login
    const loginRes1 = await loginUser(prisma, {
      email: 'preserve.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(loginRes1.rawToken).toBeDefined();

    // Subsequent conflicting login
    await expect(
      loginUser(prisma, {
        email: 'preserve.user@example.com',
        password: 'ValidPassword123!',
      })
    ).rejects.toThrow(ActiveSessionExistsError);

    // Verify existing session remains valid and NOT revoked
    const validLookup = await validateSession(prisma, loginRes1.rawToken);
    expect(validLookup).not.toBeNull();
    expect(validLookup?.user.id).toBe(user.id);
  });

  it('9. Expired, idle (>30m), and revoked sessions do not block new login attempts', async () => {
    const user = await createTestUser('bypass.user@example.com', AccountStatus.ACTIVE);

    // 1. Prior idle session (>30m)
    const idleLogin = await loginUser(prisma, {
      email: 'bypass.user@example.com',
      password: 'ValidPassword123!',
    });
    const idleTokenHash = hashSessionToken(idleLogin.rawToken);
    const thirtyOneMinsAgo = new Date(Date.now() - (SESSION_IDLE_TIMEOUT_MS + 60000));
    await prisma.session.update({
      where: { sessionTokenHash: idleTokenHash },
      data: { lastSeenAt: thirtyOneMinsAgo },
    });

    // New login succeeds (auto-prunes idle session)
    const newLogin1 = await loginUser(prisma, {
      email: 'bypass.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(newLogin1.rawToken).toBeDefined();

    // Verify old idle session is now revoked in DB
    const oldIdleDb = await prisma.session.findUnique({
      where: { sessionTokenHash: idleTokenHash },
    });
    expect(oldIdleDb?.revokedAt).not.toBeNull();

    // 2. Prior expired session (>8h)
    const expiredTokenHash = hashSessionToken(newLogin1.rawToken);
    await prisma.session.update({
      where: { sessionTokenHash: expiredTokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // New login succeeds (auto-prunes expired session)
    const newLogin2 = await loginUser(prisma, {
      email: 'bypass.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(newLogin2.rawToken).toBeDefined();

    // 3. Explicitly revoked session
    await revokeSession(prisma, newLogin2.rawToken);

    // New login succeeds
    const newLogin3 = await loginUser(prisma, {
      email: 'bypass.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(newLogin3.rawToken).toBeDefined();
  });

  it('10. Browser B succeeds after Browser A logs out from concurrent rejection', async () => {
    const user = await createTestUser('regression.user@example.com', AccountStatus.ACTIVE);

    // 1. Browser A logs in
    const loginA = await loginUser(prisma, {
      email: 'regression.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(loginA.rawToken).toBeDefined();

    // 2. Browser B attempts login and fails with 409
    await expect(
      loginUser(prisma, {
        email: 'regression.user@example.com',
        password: 'ValidPassword123!',
      })
    ).rejects.toThrow(ActiveSessionExistsError);

    // 3. Browser A logs out
    const revoked = await revokeSession(prisma, loginA.rawToken);
    expect(revoked).toBe(true);

    // 4. Browser B attempts login again and succeeds
    const loginB = await loginUser(prisma, {
      email: 'regression.user@example.com',
      password: 'ValidPassword123!',
    });
    expect(loginB.rawToken).toBeDefined();

    // 5. Verify exactly one valid active session remains
    const validLookup = await validateSession(prisma, loginB.rawToken);
    expect(validLookup).not.toBeNull();

    const allSessions = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(allSessions.length).toBe(1);
    expect(allSessions[0].id).toBe(validLookup?.session.id);
  });
});
