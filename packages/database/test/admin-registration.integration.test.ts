import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  registerAdminUser,
  DuplicateEmailError,
  MissingRoleError,
  PasswordPolicyError,
} from '../src/admin-registration';
import { validateTestDatabaseUrl } from '../src/owner-provisioning';
import { seedRBAC } from '../prisma/seed';
import { verifyPassword } from '../src/password-service';

describe('TASK-0203 Public Admin Registration Integration Test Suite', () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL environment variable is required to run integration tests.\n' +
        'Example: TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/kebun_melon_disposable_test"\n' +
        'Or run: npm run db:test:admin-reg-integration:docker'
    );
  }

  // Validate test database URL safety (requires db name to contain 'test' or 'disposable')
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

  it('1. Valid registration creates exactly one PENDING_APPROVAL user, 1 ADMIN assignment, 0 OWNER assignments, and Argon2id hash', async () => {
    const input = {
      fullName: 'Verified Pending Admin',
      email: '  Candidate.Admin@Example.COM ',
      password: 'SecurePassword123!',
    };

    const res = await registerAdminUser(prisma, input);

    expect(res.user).toBeDefined();
    expect(res.user.fullName).toBe('Verified Pending Admin');
    expect(res.user.email).toBe('candidate.admin@example.com');
    expect(res.user.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);

    // Verify DB count
    const totalUsers = await prisma.user.count();
    expect(totalUsers).toBe(1);

    const dbUser = await prisma.user.findUnique({
      where: { id: res.user.id },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser?.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);

    // Exactly one ADMIN assignment, zero OWNER assignments
    const adminAssignments = dbUser?.userRoles.filter((ur) => ur.role.code === UserRole.ADMIN);
    const ownerAssignments = dbUser?.userRoles.filter((ur) => ur.role.code === UserRole.OWNER);

    expect(adminAssignments).toHaveLength(1);
    expect(ownerAssignments).toHaveLength(0);

    // Password is Argon2id hashed
    expect(dbUser?.passwordHash.startsWith('$argon2id$')).toBe(true);
    const isPasswordValid = await verifyPassword(dbUser!.passwordHash, 'SecurePassword123!');
    expect(isPasswordValid).toBe(true);
  });

  it('2. Duplicate and mixed-case email are rejected', async () => {
    const input = {
      fullName: 'Admin One',
      email: 'admin.unique@example.com',
      password: 'SecurePassword123!',
    };

    await registerAdminUser(prisma, input);

    const duplicateInput = {
      fullName: 'Admin Two',
      email: '  ADMIN.UNIQUE@EXAMPLE.COM ', // Mixed-case + whitespace
      password: 'AnotherPassword123!',
    };

    await expect(registerAdminUser(prisma, duplicateInput)).rejects.toThrow(DuplicateEmailError);
  });

  it('3. Role, status, permission, and device-assignment injection are rejected', async () => {
    const maliciousInput = {
      fullName: 'Attacker Admin',
      email: 'attacker@example.com',
      password: 'SecurePassword123!',
      role: 'OWNER',
      accountStatus: 'ACTIVE',
      permissions: ['ALL'],
      assignedDevices: ['device-1'],
    };

    await expect(registerAdminUser(prisma, maliciousInput)).rejects.toThrow();

    // Verify database remains untouched
    const userCount = await prisma.user.count();
    expect(userCount).toBe(0);
  });

  it('4. Audit record contains no plaintext password or password hash', async () => {
    const input = {
      fullName: 'Audited Admin',
      email: 'audited@example.com',
      password: 'SecurePassword123!',
    };

    const res = await registerAdminUser(prisma, input);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        targetId: res.user.id,
        eventKey: 'ACCOUNT_REGISTER_ADMIN',
      },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog?.result).toBe('SUCCESS');

    const auditString = JSON.stringify(auditLog);
    expect(auditString).not.toContain('SecurePassword123!');
    expect(auditString).not.toContain('$argon2id$');
  });

  it('5. Transaction failure leaves no partial user or role assignment record', async () => {
    // Force transaction failure by deleting canonical ADMIN role
    await prisma.userRoleAssignment.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();

    const input = {
      fullName: 'Failed Registration Admin',
      email: 'failedreg@example.com',
      password: 'SecurePassword123!',
    };

    await expect(registerAdminUser(prisma, input)).rejects.toThrow(MissingRoleError);

    // Verify zero users and zero role assignments exist
    const userCount = await prisma.user.count();
    const assignmentCount = await prisma.userRoleAssignment.count();
    expect(userCount).toBe(0);
    expect(assignmentCount).toBe(0);
  });
});
