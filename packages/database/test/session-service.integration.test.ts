import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loginUser,
  validateSession,
  revokeSession,
  hashSessionToken,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
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

  it('4. Session lookup enforces 30-min idle and 12-hour absolute timeouts', async () => {
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

    // Create a new session for 12-hour absolute test
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
});
