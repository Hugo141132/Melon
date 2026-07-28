import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import {
  provisionFirstOwner,
  validatePasswordPolicy,
  normaliseEmail,
  validateTestDatabaseUrl,
  verifyOwnerPassword,
} from '../src/owner-provisioning';
import { seedRBAC } from '../prisma/seed';

describe('Permanent TASK-0106 First Owner Provisioning Test Suite', () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  // Validate test database URL safety
  validateTestDatabaseUrl(testDbUrl);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: testDbUrl! },
    },
  });

  async function cleanDatabase() {
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
    await prisma.$connect();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  describe('1. Unit & Helper Validation', () => {
    it('normalises email correctly with trim and lowercase', () => {
      expect(normaliseEmail('  Owner.Test@Example.COM  ')).toBe('owner.test@example.com');
    });

    it('enforces approved password policy from docs/SECURITY.md §8.2', () => {
      // Too short (<12 chars)
      expect(validatePasswordPolicy('Short1!').valid).toBe(false);
      // Missing uppercase
      expect(validatePasswordPolicy('lowercase123!').valid).toBe(false);
      // Missing lowercase
      expect(validatePasswordPolicy('UPPERCASE123!').valid).toBe(false);
      // Missing digit
      expect(validatePasswordPolicy('NoDigitHere!@').valid).toBe(false);
      // Missing special char
      expect(validatePasswordPolicy('NoSpecialChar123').valid).toBe(false);

      // Valid passphrases meeting all 5 requirements
      expect(validatePasswordPolicy('ValidPassphrase123!').valid).toBe(true);
      expect(validatePasswordPolicy('Complex#Owner2026Pass').valid).toBe(true);
    });

    it('rejects test execution against unsafe database URLs', () => {
      expect(() => validateTestDatabaseUrl(undefined)).toThrow();
      expect(() =>
        validateTestDatabaseUrl('postgresql://user:pass@localhost:5432/production_db')
      ).toThrow(/must explicitly contain 'test' or 'disposable'/);
      expect(() =>
        validateTestDatabaseUrl('postgresql://user:pass@localhost:5432/my_app_test')
      ).not.toThrow();
    });
  });

  describe('2. Precondition & Dependency Failures', () => {
    beforeEach(async () => {
      await cleanDatabase();
    });

    it('fails clearly when canonical OWNER role is missing from database', async () => {
      await expect(
        provisionFirstOwner(prisma, {
          email: 'owner@example.com',
          password: 'ValidPassword123!',
          fullName: 'Test Owner',
        })
      ).rejects.toThrow(/Canonical OWNER role is missing from the database/);

      const userCount = await prisma.user.count();
      expect(userCount).toBe(0);
      const auditCount = await prisma.auditLog.count();
      expect(auditCount).toBe(0);
    });

    it('tests mixed-case duplicate email rejection when non-Owner user already exists', async () => {
      await seedRBAC(prisma);

      const adminRole = await prisma.role.findUnique({ where: { code: UserRole.ADMIN } });
      expect(adminRole).not.toBeNull();

      // Pre-create a non-Owner Admin user with normalised email 'existingadmin@example.com'
      const existingAdmin = await prisma.user.create({
        data: {
          fullName: 'Existing Admin',
          email: 'existingadmin@example.com',
          passwordHash: 'dummyhash',
          accountStatus: AccountStatus.PENDING_APPROVAL,
        },
      });

      await prisma.userRoleAssignment.create({
        data: {
          userId: existingAdmin.id,
          roleId: adminRole!.id,
        },
      });

      // Verify no OWNER role assignment exists yet
      const ownerAssignmentCount = await prisma.userRoleAssignment.count({
        where: { role: { code: UserRole.OWNER }, revokedAt: null },
      });
      expect(ownerAssignmentCount).toBe(0);

      // Attempt provisioning with mixed-case duplicate email 'ExIsTiNgAdMiN@eXaMpLe.CoM'
      await expect(
        provisionFirstOwner(prisma, {
          email: 'ExIsTiNgAdMiN@eXaMpLe.CoM',
          password: 'ValidPassword123!',
          fullName: 'Owner Duplicate Attempt',
        })
      ).rejects.toThrow(/User with email 'existingadmin@example.com' already exists/);

      // Verify no Owner user was created
      const ownerCount = await prisma.userRoleAssignment.count({
        where: { role: { code: UserRole.OWNER } },
      });
      expect(ownerCount).toBe(0);
    });
  });

  describe('3. Successful First Owner Provisioning & Lifecycle', () => {
    beforeEach(async () => {
      await cleanDatabase();
      await seedRBAC(prisma);
    });

    it('creates exactly one ACTIVE Owner user, OWNER role assignment, and AuditLog entry', async () => {
      const result = await provisionFirstOwner(prisma, {
        email: '  Initial.OWNER@KebunMelon.Local  ',
        password: 'ValidPassword123!',
        fullName: 'System Owner One',
      });

      expect(result.user.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(result.user.email).toBe('initial.owner@kebunmelon.local');
      expect(result.user.fullName).toBe('System Owner One');

      // Database verifications
      const usersInDb = await prisma.user.findMany({
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      expect(usersInDb.length).toBe(1);
      const createdUser = usersInDb[0];
      expect(createdUser.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(createdUser.userRoles.length).toBe(1);
      expect(createdUser.userRoles[0].role.code).toBe(UserRole.OWNER);
      expect(createdUser.userRoles[0].revokedAt).toBeNull();

      // Verify 0 ADMIN assignments created
      const adminAssignments = await prisma.userRoleAssignment.count({
        where: { role: { code: UserRole.ADMIN } },
      });
      expect(adminAssignments).toBe(0);

      // Verify 0 AccountApproval rows created (direct provisioning)
      const approvalCount = await prisma.accountApproval.count();
      expect(approvalCount).toBe(0);

      // Verify AuditLog creation with null actor and non-sensitive payload
      const auditLogs = await prisma.auditLog.findMany();
      expect(auditLogs.length).toBe(1);
      const audit = auditLogs[0];
      expect(audit.eventKey).toBe('ACCOUNT_PROVISION_OWNER');
      expect(audit.actorUserId).toBeNull();
      expect(audit.actorRole).toBeNull();
      expect(audit.result).toBe('SUCCESS');
      expect(audit.targetId).toBe(createdUser.id);

      // Verify audit contains no secrets or DB URLs
      const auditStr = JSON.stringify(audit);
      expect(auditStr).not.toContain('ValidPassword123!');
      expect(auditStr).not.toContain(createdUser.passwordHash);
      expect(auditStr).not.toContain('postgresql://');

      // Verify Argon2id hashing via library verify function
      expect(createdUser.passwordHash).toMatch(/^\$argon2id\$/);
      const passwordValid = await verifyOwnerPassword(
        createdUser.passwordHash,
        'ValidPassword123!'
      );
      expect(passwordValid).toBe(true);

      const invalidPasswordValid = await verifyOwnerPassword(
        createdUser.passwordHash,
        'WrongPassword123!'
      );
      expect(invalidPasswordValid).toBe(false);
    });

    it('rejects a second provisioning attempt safely when an Owner already exists', async () => {
      // First run succeeds
      await provisionFirstOwner(prisma, {
        email: 'owner1@example.com',
        password: 'ValidPassword123!',
        fullName: 'Owner One',
      });

      // Second run fails safely
      await expect(
        provisionFirstOwner(prisma, {
          email: 'owner2@example.com',
          password: 'ValidPassword123!',
          fullName: 'Owner Two',
        })
      ).rejects.toThrow(/First Owner account already exists/);

      const totalUsers = await prisma.user.count();
      expect(totalUsers).toBe(1);
      const ownerAssignments = await prisma.userRoleAssignment.count({
        where: { role: { code: UserRole.OWNER }, revokedAt: null },
      });
      expect(ownerAssignments).toBe(1);
    });

    it('rejects second provisioning attempt even if the existing Owner account is SUSPENDED or DEACTIVATED', async () => {
      // Create first owner
      const res = await provisionFirstOwner(prisma, {
        email: 'owner.suspended@example.com',
        password: 'ValidPassword123!',
        fullName: 'Suspended Owner',
      });

      // Update owner account status to SUSPENDED
      await prisma.user.update({
        where: { id: res.user.id },
        data: { accountStatus: AccountStatus.SUSPENDED, suspendedAt: new Date() },
      });

      // Second attempt must still be rejected
      await expect(
        provisionFirstOwner(prisma, {
          email: 'newowner@example.com',
          password: 'ValidPassword123!',
          fullName: 'Second Owner Attempt',
        })
      ).rejects.toThrow(/First Owner account already exists/);

      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('4. Transaction Rollback & Ordinary Seed Separation', () => {
    beforeEach(async () => {
      await cleanDatabase();
      await seedRBAC(prisma);
    });

    it('rolls back completely on error, leaving 0 new users, 0 assignments, and 0 audit records', async () => {
      await expect(
        provisionFirstOwner(
          prisma,
          {
            email: 'rollback@example.com',
            password: 'ValidPassword123!',
            fullName: 'Rollback User',
          },
          { simulateFailure: true }
        )
      ).rejects.toThrow('SIMULATED_PROVISIONING_FAILURE');

      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.userRoleAssignment.count()).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
    });

    it('confirms ordinary RBAC seed creates 0 users, 0 sessions, 0 device assignments', async () => {
      await cleanDatabase();
      await seedRBAC(prisma);

      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.userRoleAssignment.count()).toBe(0);
      expect(await prisma.session.count()).toBe(0);
      expect(await prisma.userDeviceAccess.count()).toBe(0);
    });
  });

  describe('5. Separate OS Process Concurrency Verification', () => {
    beforeEach(async () => {
      await cleanDatabase();
      await seedRBAC(prisma);
    });

    it('executes two separate OS processes simultaneously and verifies exactly 1 succeeds and 1 fails', async () => {
      const scriptPath = path.resolve(__dirname, '../scripts/seed-owner.ts');

      const envVars = {
        ...process.env,
        IS_TEST_RUN: 'true',
        TEST_DATABASE_URL: testDbUrl!,
        DATABASE_URL: testDbUrl!,
        OWNER_PASSWORD: 'ValidPassword123!',
      };

      const runProcess = (
        email: string,
        name: string
      ): Promise<{ code: number; stdout: string; stderr: string }> => {
        return new Promise((resolve) => {
          const proc = spawn('npx', ['tsx', `"${scriptPath}"`], {
            env: {
              ...envVars,
              OWNER_EMAIL: email,
              OWNER_NAME: name,
            },
            cwd: path.resolve(__dirname, '..'),
            shell: true,
          });

          let stdout = '';
          let stderr = '';

          proc.stdout?.on('data', (data) => (stdout += data.toString()));
          proc.stderr?.on('data', (data) => (stderr += data.toString()));

          proc.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
          });
        });
      };

      // Launch TWO SEPARATE OS PROCESSES simultaneously
      const [res1, res2] = await Promise.all([
        runProcess('concurrent1@example.com', 'Concurrent Owner One'),
        runProcess('concurrent2@example.com', 'Concurrent Owner Two'),
      ]);

      const exitCodes = [res1.code, res2.code].sort();

      if (exitCodes[0] !== 0 || exitCodes[1] !== 1) {
        console.error('Process 1 stdout:', res1.stdout, 'stderr:', res1.stderr);
        console.error('Process 2 stdout:', res2.stdout, 'stderr:', res2.stderr);
      }

      // Exactly one process must exit 0 and exactly one process must exit 1 (non-zero)
      expect(exitCodes).toEqual([0, 1]);

      // Database verification after race condition
      const totalUsers = await prisma.user.count();
      expect(totalUsers).toBe(1);

      const ownerAssignments = await prisma.userRoleAssignment.count({
        where: { role: { code: UserRole.OWNER }, revokedAt: null },
      });
      expect(ownerAssignments).toBe(1);

      const auditEntries = await prisma.auditLog.count({
        where: { eventKey: 'ACCOUNT_PROVISION_OWNER' },
      });
      expect(auditEntries).toBe(1);
    }, 30000);
  });
});
