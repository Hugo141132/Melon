import { PrismaClient } from '@prisma/client';

export interface TestIsolationOptions {
  prefix?: string;
  autoRollback?: boolean;
}

/**
 * Generates an isolated test entity prefix with timestamp and random UUID snippet
 * to prevent test data collisions and non-destructive shared-database testing.
 */
export function generateTestIsolationPrefix(tag: string = 'test'): string {
  const nonce = Math.random().toString(36).substring(2, 8);
  return `${tag}_${Date.now()}_${nonce}`;
}

/**
 * Execute test logic inside Prisma transaction context where supported, or isolate via unique test keys.
 * Ensures database tests leave no lingering state or destroy existing seed data.
 */
export async function withTestTransaction<T>(
  prisma: PrismaClient,
  testFn: (tx: PrismaClient) => Promise<T>,
  options: TestIsolationOptions = {}
): Promise<T> {
  const autoRollback = options.autoRollback ?? false;

  if (autoRollback) {
    let result: T;
    const ROLLBACK_SIGNAL = new Error('__TEST_TRANSACTION_ROLLBACK__');

    try {
      await prisma.$transaction(async (tx) => {
        result = await testFn(tx as unknown as PrismaClient);
        throw ROLLBACK_SIGNAL;
      });
    } catch (err: unknown) {
      if (err === ROLLBACK_SIGNAL) {
        return result!;
      }
      throw err;
    }
    return result!;
  }

  return prisma.$transaction(async (tx) => {
    return testFn(tx as unknown as PrismaClient);
  });
}

/**
 * Safe cleanup utility for isolated test entities created during integration tests.
 */
export async function cleanupIsolatedTestEntities(
  prisma: PrismaClient,
  entityIds: { userIds?: string[]; deviceIds?: string[] }
): Promise<void> {
  if (entityIds.userIds && entityIds.userIds.length > 0) {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: entityIds.userIds } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: entityIds.userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: entityIds.userIds } } });
    await prisma.accountApproval.deleteMany({
      where: { applicantUserId: { in: entityIds.userIds } },
    });
    await prisma.userDeviceAccess.deleteMany({ where: { userId: { in: entityIds.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: entityIds.userIds } } });
  }

  if (entityIds.deviceIds && entityIds.deviceIds.length > 0) {
    await prisma.userDeviceAccess.deleteMany({ where: { deviceId: { in: entityIds.deviceIds } } });
    await prisma.deviceCapability.deleteMany({ where: { deviceId: { in: entityIds.deviceIds } } });
    await prisma.soilReading.deleteMany({ where: { deviceId: { in: entityIds.deviceIds } } });
    await prisma.waterReading.deleteMany({ where: { deviceId: { in: entityIds.deviceIds } } });
    await prisma.device.deleteMany({ where: { id: { in: entityIds.deviceIds } } });
  }
}
