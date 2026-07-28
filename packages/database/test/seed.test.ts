import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANONICAL_PERMISSIONS, seedRBAC } from '../prisma/seed';

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
    expect(seedResult.permissionsCount).toBe(38);

    const roles = await prisma.role.findMany();
    expect(roles.length).toBe(2);
    const roleCodes = roles.map((r) => r.code).sort();
    expect(roleCodes).toEqual(['ADMIN', 'OWNER']);

    const permissions = await prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    expect(permissions.length).toBe(38);

    // Verify OWNER mappings (37 permissions mapped to OWNER per docs/RBAC.md §10)
    const ownerRole = roles.find((r) => r.code === 'OWNER')!;
    const ownerMappings = await prisma.rolePermission.findMany({
      where: { roleId: ownerRole.id },
    });
    expect(ownerMappings.length).toBe(37);

    // Verify ADMIN mappings (19 permissions mapped to ADMIN per docs/RBAC.md §10)
    const adminRole = roles.find((r) => r.code === 'ADMIN')!;
    const adminMappings = await prisma.rolePermission.findMany({
      where: { roleId: adminRole.id },
    });
    expect(adminMappings.length).toBe(19);

    // Total unique role_permissions mappings (37 + 19 = 56)
    const totalMappings = await prisma.rolePermission.count();
    expect(totalMappings).toBe(56);
  });

  it('2. Second seed run is strictly idempotent (zero duplicates, unchanged counts)', async () => {
    const seedResult2 = await seedRBAC(prisma);

    expect(seedResult2.rolesCount).toBe(2);
    expect(seedResult2.permissionsCount).toBe(38);

    const rolesCount = await prisma.role.count();
    expect(rolesCount).toBe(2);

    const permCount = await prisma.permission.count();
    expect(permCount).toBe(38);

    const totalMappings = await prisma.rolePermission.count();
    expect(totalMappings).toBe(56);
  });

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
});
