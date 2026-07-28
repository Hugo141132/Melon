import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Live PostgreSQL Database Integration & Constraint Verification', () => {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL must be provided for database integration tests.'
    );
  }

  // Refuse execution if host is production or non-test port/db
  if (!databaseUrl.includes('55432') && !databaseUrl.includes('test')) {
    throw new Error(
      'Refusing to run integration tests against potentially non-test database: ' + databaseUrl
    );
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test entities created during suite
    await prisma.$disconnect();
  });

  it('1. User email uniqueness constraint', async () => {
    const testEmail = `test_unique_${Date.now()}@example.com`;
    await prisma.user.create({
      data: {
        fullName: 'Test User 1',
        email: testEmail,
        passwordHash: 'hash123',
        accountStatus: 'PENDING_APPROVAL',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          fullName: 'Test User 2',
          email: testEmail,
          passwordHash: 'hash456',
          accountStatus: 'PENDING_APPROVAL',
        },
      })
    ).rejects.toThrow();
  });

  it('2. Session token hash uniqueness constraint', async () => {
    const user = await prisma.user.create({
      data: {
        fullName: 'Session Test User',
        email: `session_user_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const sessionHash = `token_hash_${Date.now()}`;
    await prisma.session.create({
      data: {
        sessionTokenHash: sessionHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    await expect(
      prisma.session.create({
        data: {
          sessionTokenHash: sessionHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      })
    ).rejects.toThrow();
  });

  it('3. Device identifier uniqueness constraint', async () => {
    const uniqueDeviceId = `device-node-${Date.now()}`;
    await prisma.device.create({
      data: {
        deviceId: uniqueDeviceId,
        name: 'Test Node 1',
        deviceType: 'SOIL_NODE',
        connectionStatus: 'ONLINE',
      },
    });

    await expect(
      prisma.device.create({
        data: {
          deviceId: uniqueDeviceId,
          name: 'Test Node 2',
          deviceType: 'WATER_NODE',
          connectionStatus: 'OFFLINE',
        },
      })
    ).rejects.toThrow();
  });

  it('4. Idempotency key uniqueness constraint', async () => {
    const owner = await prisma.user.create({
      data: {
        fullName: 'Owner User',
        email: `owner_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const device = await prisma.device.create({
      data: {
        deviceId: `faucet-node-${Date.now()}`,
        name: 'Faucet Node 1',
        deviceType: 'WATER_NODE',
        connectionStatus: 'ONLINE',
      },
    });

    const idempotencyKey = `idem_key_${Date.now()}`;
    const commandId1 = `cmd_id_1_${Date.now()}`;
    const commandId2 = `cmd_id_2_${Date.now()}`;

    await prisma.faucetCommand.create({
      data: {
        commandId: commandId1,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 1,
        targetVolumeMl: 300,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey,
      },
    });

    await expect(
      prisma.faucetCommand.create({
        data: {
          commandId: commandId2,
          deviceId: device.id,
          initiatedByUserId: owner.id,
          initiatedByRole: 'OWNER',
          phase: 1,
          targetVolumeMl: 300,
          status: 'QUEUED',
          expiresAt: new Date(Date.now() + 60000),
          idempotencyKey,
        },
      })
    ).rejects.toThrow();
  });

  it('5. Max 1 active faucet command per device (Partial Unique Index)', async () => {
    const owner = await prisma.user.create({
      data: {
        fullName: 'Active Command Owner',
        email: `active_owner_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const device = await prisma.device.create({
      data: {
        deviceId: `active-cmd-node-${Date.now()}`,
        name: 'Active Command Node',
        deviceType: 'WATER_NODE',
        connectionStatus: 'ONLINE',
      },
    });

    // 1st command: active (QUEUED)
    await prisma.faucetCommand.create({
      data: {
        commandId: `active_cmd_1_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 1,
        targetVolumeMl: 300,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_active_1_${Date.now()}`,
      },
    });

    // 2nd command: active (SENT) -> should fail due to partial unique index
    await expect(
      prisma.faucetCommand.create({
        data: {
          commandId: `active_cmd_2_${Date.now()}`,
          deviceId: device.id,
          initiatedByUserId: owner.id,
          initiatedByRole: 'OWNER',
          phase: 2,
          targetVolumeMl: 1000,
          status: 'SENT',
          expiresAt: new Date(Date.now() + 60000),
          idempotencyKey: `idem_active_2_${Date.now()}`,
        },
      })
    ).rejects.toThrow();
  });

  it('6. Terminal state allows new faucet command for device', async () => {
    const owner = await prisma.user.create({
      data: {
        fullName: 'Terminal State Owner',
        email: `term_owner_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const device = await prisma.device.create({
      data: {
        deviceId: `term-cmd-node-${Date.now()}`,
        name: 'Terminal State Node',
        deviceType: 'WATER_NODE',
        connectionStatus: 'ONLINE',
      },
    });

    // Create command and update to terminal COMPLETED
    const cmd1 = await prisma.faucetCommand.create({
      data: {
        commandId: `term_cmd_1_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 1,
        targetVolumeMl: 300,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_term_1_${Date.now()}`,
      },
    });

    await prisma.faucetCommand.update({
      where: { id: cmd1.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Now a new command should succeed because cmd1 is in a terminal state
    const cmd2 = await prisma.faucetCommand.create({
      data: {
        commandId: `term_cmd_2_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 2,
        targetVolumeMl: 1000,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_term_2_${Date.now()}`,
      },
    });

    expect(cmd2.id).toBeDefined();
  });

  it('7. Faucet Phase-Volume check constraints (Positive & Negative)', async () => {
    const owner = await prisma.user.create({
      data: {
        fullName: 'Phase Check Owner',
        email: `phase_owner_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const device = await prisma.device.create({
      data: {
        deviceId: `phase-cmd-node-${Date.now()}`,
        name: 'Phase Check Node',
        deviceType: 'WATER_NODE',
        connectionStatus: 'ONLINE',
      },
    });

    // Valid Phase 1 (300 mL)
    const p1 = await prisma.faucetCommand.create({
      data: {
        commandId: `p1_valid_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 1,
        targetVolumeMl: 300,
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_p1_${Date.now()}`,
      },
    });
    expect(p1.id).toBeDefined();

    // Valid Phase 2 (1000 mL)
    const p2 = await prisma.faucetCommand.create({
      data: {
        commandId: `p2_valid_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 2,
        targetVolumeMl: 1000,
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_p2_${Date.now()}`,
      },
    });
    expect(p2.id).toBeDefined();

    // Valid Phase 3 (1500 mL)
    const p3 = await prisma.faucetCommand.create({
      data: {
        commandId: `p3_valid_${Date.now()}`,
        deviceId: device.id,
        initiatedByUserId: owner.id,
        initiatedByRole: 'OWNER',
        phase: 3,
        targetVolumeMl: 1500,
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 60000),
        idempotencyKey: `idem_p3_${Date.now()}`,
      },
    });
    expect(p3.id).toBeDefined();

    // Invalid Phase 1 with 1000 mL -> check constraint failure
    await expect(
      prisma.faucetCommand.create({
        data: {
          commandId: `invalid_p1_${Date.now()}`,
          deviceId: device.id,
          initiatedByUserId: owner.id,
          initiatedByRole: 'OWNER',
          phase: 1,
          targetVolumeMl: 1000,
          status: 'QUEUED',
          expiresAt: new Date(Date.now() + 60000),
          idempotencyKey: `idem_inv_p1_${Date.now()}`,
        },
      })
    ).rejects.toThrow();
  });

  it('8. Foreign key RESTRICT deletion policy on User with dependencies', async () => {
    const user = await prisma.user.create({
      data: {
        fullName: 'Restrict User',
        email: `restrict_user_${Date.now()}@example.com`,
        passwordHash: 'hash123',
        accountStatus: 'ACTIVE',
      },
    });

    const adminRole = await prisma.role.create({
      data: {
        code: 'ADMIN',
        name: 'Administrator',
      },
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
      },
    });

    // Attempting to delete user when user_roles has RESTRICT FK should fail
    await expect(
      prisma.user.delete({
        where: { id: user.id },
      })
    ).rejects.toThrow();
  });
});
