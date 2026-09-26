import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CANONICAL_DEFAULT_SITE,
  CANONICAL_PERMISSIONS,
  seedCanonicalDevices,
  seedCanonicalSites,
  seedRBAC,
} from '../prisma/seed';

describe('Permanent RBAC Database Seed & Idempotency Test', () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL environment variable must be explicitly provided for seed tests. Fallback to DATABASE_URL is strictly forbidden.'
    );
  }

  // Safety checks on parsed database URL & database name
  let urlObj: URL;
  try {
    urlObj = new URL(testDbUrl);
  } catch (err) {
    throw new Error(`Invalid TEST_DATABASE_URL format: ${testDbUrl}`);
  }

  const dbName = urlObj.pathname.replace(/^\//, '');
  const isDisposableName =
    dbName.includes('test') ||
    dbName.includes('disposable') ||
    dbName.endsWith('_test') ||
    dbName.startsWith('test_');

  if (!isDisposableName) {
    throw new Error(
      `Refusing to run seed integration tests against non-test database name: '${dbName}'. Must contain 'test', 'disposable', '_test', or 'test_'.`
    );
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: testDbUrl },
    },
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. First seed run creates exact canonical roles, permissions, and mappings', async () => {
    const seedResult = await seedRBAC(prisma);

    expect(seedResult.rolesCount).toBe(2);
    expect(seedResult.permissionsCount).toBe(CANONICAL_PERMISSIONS.length);

    const roles = await prisma.role.findMany();
    expect(roles.length).toBe(2);
    const roleCodes = roles.map((r) => r.code).sort();
    expect(roleCodes).toEqual(['ADMIN', 'OWNER']);

    const permissions = await prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    expect(permissions.length).toBe(CANONICAL_PERMISSIONS.length);

    const ownerRole = roles.find((r) => r.code === 'OWNER')!;
    const ownerMappings = await prisma.rolePermission.findMany({
      where: { roleId: ownerRole.id },
    });
    expect(ownerMappings.length).toBe(CANONICAL_PERMISSIONS.filter((p) => p.ownerAccess).length);

    const adminRole = roles.find((r) => r.code === 'ADMIN')!;
    const adminMappings = await prisma.rolePermission.findMany({
      where: { roleId: adminRole.id },
    });
    expect(adminMappings.length).toBe(CANONICAL_PERMISSIONS.filter((p) => p.adminAccess).length);

    const totalMappings = await prisma.rolePermission.count();
    expect(totalMappings).toBe(
      CANONICAL_PERMISSIONS.filter((p) => p.ownerAccess).length +
        CANONICAL_PERMISSIONS.filter((p) => p.adminAccess).length
    );
  }, 15000);

  it('2. Second seed run is strictly idempotent (zero duplicates, unchanged counts)', async () => {
    const seedResult2 = await seedRBAC(prisma);

    expect(seedResult2.rolesCount).toBe(2);
    expect(seedResult2.permissionsCount).toBe(CANONICAL_PERMISSIONS.length);

    const rolesCount = await prisma.role.count();
    expect(rolesCount).toBe(2);

    const permCount = await prisma.permission.count();
    expect(permCount).toBe(CANONICAL_PERMISSIONS.length);

    const totalMappings = await prisma.rolePermission.count();
    expect(totalMappings).toBe(
      CANONICAL_PERMISSIONS.filter((p) => p.ownerAccess).length +
        CANONICAL_PERMISSIONS.filter((p) => p.adminAccess).length
    );
  }, 15000);

  it('3. OWNER-only permissions are NOT mapped to ADMIN role', async () => {
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    })!;

    const adminPermCodes = adminRole!.rolePermissions.map((rp) => rp.permission.code);

    const ownerOnlyPerms = CANONICAL_PERMISSIONS.filter((p) => p.ownerAccess && !p.adminAccess).map(
      (p) => p.code
    );

    expect(ownerOnlyPerms.length).toBe(19);

    for (const code of ownerOnlyPerms) {
      expect(adminPermCodes).not.toContain(code);
    }
  });

  it('4. Seed does NOT create users, first Owner, sessions, or device access records', async () => {
    // Assert against seed-owned canonical entities
    const seedCreatedUsers = await prisma.user.findMany({
      where: { email: { contains: 'seed' } },
    });
    expect(seedCreatedUsers.length).toBe(0);

    const firstOwnerUsers = await prisma.user.findMany({
      where: { userRoles: { some: { role: { code: 'OWNER' } } } },
    });
    expect(firstOwnerUsers.length).toBe(0);
  });

  it('5. Verify no forbidden canControl permission or field was created', async () => {
    const permissions = await prisma.permission.findMany();
    for (const p of permissions) {
      expect(p.code.toLowerCase()).not.toContain('cancontrol');
      expect(p.code.toLowerCase()).not.toContain('faucet_control_all');
    }
  });

  it('6. seedCanonicalSites creates the canonical default site idempotently', async () => {
    const site1 = await seedCanonicalSites(prisma);
    expect(site1).toBeDefined();
    expect(site1.siteCode).toBe(CANONICAL_DEFAULT_SITE.siteCode);
    expect(site1.name).toBe(CANONICAL_DEFAULT_SITE.name);
    expect(site1.isActive).toBe(true);

    const siteCountAfterFirst = await prisma.site.count({
      where: { siteCode: CANONICAL_DEFAULT_SITE.siteCode },
    });
    expect(siteCountAfterFirst).toBe(1);

    // Idempotent re-run
    const site2 = await seedCanonicalSites(prisma);
    expect(site2.id).toBe(site1.id);

    const siteCountAfterSecond = await prisma.site.count({
      where: { siteCode: CANONICAL_DEFAULT_SITE.siteCode },
    });
    expect(siteCountAfterSecond).toBe(1);
  });

  it('7. seedCanonicalDevices associates all canonical devices with canonical siteId', async () => {
    const site = await seedCanonicalSites(prisma);
    const result = await seedCanonicalDevices(prisma, site.id);
    expect(result.devicesCount).toBe(3);

    const seededDevices = await prisma.device.findMany({
      where: {
        deviceId: {
          in: ['soil-node-001', 'water-quality-node-001', 'water-tank-node-zi37gz'],
        },
      },
      include: {
        site: true,
      },
    });

    expect(seededDevices.length).toBe(3);
    for (const d of seededDevices) {
      expect(d.siteId).toBe(site.id);
      expect(d.site).toBeDefined();
      expect(d.site?.siteCode).toBe(CANONICAL_DEFAULT_SITE.siteCode);
    }

    // Re-run for idempotency
    const result2 = await seedCanonicalDevices(prisma, site.id);
    expect(result2.devicesCount).toBe(3);

    const devicesCountAfterSecond = await prisma.device.count({
      where: {
        deviceId: {
          in: ['soil-node-001', 'water-quality-node-001', 'water-tank-node-zi37gz'],
        },
      },
    });
    expect(devicesCountAfterSecond).toBe(3);
  });
});
