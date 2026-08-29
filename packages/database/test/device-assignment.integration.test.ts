import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient, UserRole, AccountStatus, DeviceType } from '@prisma/client';
import {
  DeviceAssignmentRepository,
  DeviceAssignmentError,
} from '../src/device-assignment-repository';
import { validateTestDatabaseUrl } from '../src/owner-provisioning';

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('DeviceAssignmentRepository Integration Tests', { timeout: 30000 }, () => {
    let prisma: PrismaClient;
    let repo: DeviceAssignmentRepository;

    let ownerUser: any;
    let activeAdminUser: any;
    let pendingAdminUser: any;
    let testDevice: any;

    beforeEach(async () => {
      const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'TEST_DATABASE_URL or DATABASE_URL must be provided for integration tests.'
        );
      }
      validateTestDatabaseUrl(url);
      prisma = new PrismaClient({ datasources: { db: { url } } });
      repo = new DeviceAssignmentRepository(prisma);

      // Clean up test assignments & test records
      await prisma.userDeviceAccess.deleteMany({
        where: {
          OR: [
            { user: { email: { startsWith: 'assign_test_' } } },
            { device: { deviceId: { startsWith: 'assign-dev-' } } },
          ],
        },
      });

      await prisma.auditLog.deleteMany({
        where: { eventKey: { in: ['device.access.assigned', 'device.access.removed'] } },
      });

      await prisma.userRoleAssignment.deleteMany({
        where: { user: { email: { startsWith: 'assign_test_' } } },
      });
      await prisma.$executeRaw`DELETE FROM "user_roles" WHERE "user_id" IN (SELECT id FROM "users" WHERE email LIKE 'assign_test_%')`;

      await prisma.user.deleteMany({
        where: { email: { startsWith: 'assign_test_' } },
      });

      await prisma.device.deleteMany({
        where: { deviceId: { startsWith: 'assign-dev-' } },
      });

      // Seed Owner Role & Admin Role if missing
      const ownerRole = await prisma.role.upsert({
        where: { code: UserRole.OWNER },
        update: {},
        create: { code: UserRole.OWNER, name: 'Owner' },
      });

      const adminRole = await prisma.role.upsert({
        where: { code: UserRole.ADMIN },
        update: {},
        create: { code: UserRole.ADMIN, name: 'Admin' },
      });

      // Create Owner User
      ownerUser = await prisma.user.create({
        data: {
          fullName: 'Test Owner',
          email: 'assign_test_owner@example.com',
          passwordHash: 'hash',
          accountStatus: AccountStatus.ACTIVE,
          userRoles: { create: { roleId: ownerRole.id } },
        },
      });

      // Create Active Admin User
      activeAdminUser = await prisma.user.create({
        data: {
          fullName: 'Test Active Admin',
          email: 'assign_test_admin_active@example.com',
          passwordHash: 'hash',
          accountStatus: AccountStatus.ACTIVE,
          userRoles: { create: { roleId: adminRole.id } },
        },
      });

      // Create Pending Admin User
      pendingAdminUser = await prisma.user.create({
        data: {
          fullName: 'Test Pending Admin',
          email: 'assign_test_admin_pending@example.com',
          passwordHash: 'hash',
          accountStatus: AccountStatus.PENDING_APPROVAL,
          userRoles: { create: { roleId: adminRole.id } },
        },
      });

      // Create Test Device
      testDevice = await prisma.device.create({
        data: {
          deviceId: 'assign-dev-001',
          name: 'Assignment Test Soil Node',
          deviceType: DeviceType.SOIL_NODE,
        },
      });

      repo = new DeviceAssignmentRepository(prisma);
    });

    afterEach(async () => {
      if (prisma) {
        await prisma.userDeviceAccess.deleteMany({
          where: {
            OR: [
              { user: { email: { startsWith: 'assign_test_' } } },
              { device: { deviceId: { startsWith: 'assign-dev-' } } },
            ],
          },
        });
        await prisma.userRoleAssignment.deleteMany({
          where: { user: { email: { startsWith: 'assign_test_' } } },
        });
        await prisma.$executeRaw`DELETE FROM "user_roles" WHERE "user_id" IN (SELECT id FROM "users" WHERE email LIKE 'assign_test_%')`;
        await prisma.user.deleteMany({
          where: { email: { startsWith: 'assign_test_' } },
        });

        await prisma.device.deleteMany({
          where: { deviceId: { startsWith: 'assign-dev-' } },
        });
        await prisma.$disconnect();
      }
    });

    it('allows Owner to assign active Admin to a device and records AuditLog', async () => {
      const assignment = await repo.assignDeviceToUser({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      expect(assignment.userId).toBe(activeAdminUser.id);
      expect(assignment.deviceId).toBe(testDevice.id);
      expect(assignment.canonicalDeviceId).toBe(testDevice.deviceId);
      expect(assignment.revokedAt).toBeNull();

      // Verify AuditLog record
      const audit = await prisma.auditLog.findFirst({
        where: { eventKey: 'device.access.assigned', targetId: assignment.id },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(ownerUser.id);
    });

    it('prevents duplicate active assignments for the same user and device', async () => {
      await repo.assignDeviceToUser({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      await expect(
        repo.assignDeviceToUser({
          userId: activeAdminUser.id,
          deviceIdOrId: testDevice.deviceId,
          actorUserId: ownerUser.id,
        })
      ).rejects.toThrowError(DeviceAssignmentError);
    });

    it('rejects assigning device to an Owner user', async () => {
      await expect(
        repo.assignDeviceToUser({
          userId: ownerUser.id,
          deviceIdOrId: testDevice.deviceId,
          actorUserId: ownerUser.id,
        })
      ).rejects.toThrowError('Owner accounts have implicit global device access');
    });

    it('rejects assigning device to a PENDING_APPROVAL user', async () => {
      await expect(
        repo.assignDeviceToUser({
          userId: pendingAdminUser.id,
          deviceIdOrId: testDevice.deviceId,
          actorUserId: ownerUser.id,
        })
      ).rejects.toThrowError('Only ACTIVE Admin accounts can receive device assignments');
    });

    it('rejects non-Owner acting users', async () => {
      await expect(
        repo.assignDeviceToUser({
          userId: activeAdminUser.id,
          deviceIdOrId: testDevice.deviceId,
          actorUserId: activeAdminUser.id,
        })
      ).rejects.toThrowError('Only active Owner accounts are authorized');
    });

    it('allows Owner to revoke assignment, setting revokedAt without deleting the row', async () => {
      const assigned = await repo.assignDeviceToUser({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      const revoked = await repo.revokeDeviceAssignment({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      expect(revoked.id).toBe(assigned.id);
      expect(revoked.revokedAt).not.toBeNull();

      // Verify row still exists in DB
      const dbRow = await prisma.userDeviceAccess.findUnique({ where: { id: assigned.id } });
      expect(dbRow).toBeDefined();
      expect(dbRow?.revokedAt).not.toBeNull();

      // Verify AuditLog record
      const audit = await prisma.auditLog.findFirst({
        where: { eventKey: 'device.access.removed', targetId: assigned.id },
      });
      expect(audit).toBeDefined();
    });

    it('allows reassignment after revocation by creating a NEW row and preserving history', async () => {
      const firstAssigned = await repo.assignDeviceToUser({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      await repo.revokeDeviceAssignment({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      const secondAssigned = await repo.assignDeviceToUser({
        userId: activeAdminUser.id,
        deviceIdOrId: testDevice.deviceId,
        actorUserId: ownerUser.id,
      });

      expect(secondAssigned.id).not.toBe(firstAssigned.id);
      expect(secondAssigned.revokedAt).toBeNull();

      // List assignments including revoked
      const allAssignments = await repo.listUserDeviceAssignments(activeAdminUser.id, {
        includeRevoked: true,
      });

      expect(allAssignments.length).toBe(2);
      const activeList = await repo.listUserDeviceAssignments(activeAdminUser.id, {
        includeRevoked: false,
      });
      expect(activeList.length).toBe(1);
      expect(activeList[0].id).toBe(secondAssigned.id);
    }, 30000);
  }
);
