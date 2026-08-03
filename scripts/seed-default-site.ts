import { PrismaClient } from '@prisma/client';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });

  try {
    console.log(
      '[dev-data-fix] Finding or creating canonical default site (siteCode: "site-01")...'
    );
    const site = await prisma.site.upsert({
      where: { siteCode: 'site-01' },
      update: {
        name: 'Site 01',
        description: 'Canonical Default Site',
        isActive: true,
      },
      create: {
        siteCode: 'site-01',
        name: 'Site 01',
        description: 'Canonical Default Site',
        isActive: true,
      },
    });

    console.log(
      `[dev-data-fix] Canonical site resolved: ID=${site.id}, siteCode="${site.siteCode}"`
    );

    console.log('[dev-data-fix] Assigning siteId to device "water-tank-node-3uufzi"...');
    const updatedTargetDevice = await prisma.device.update({
      where: { deviceId: 'water-tank-node-3uufzi' },
      data: { siteId: site.id },
    });
    console.log(
      `[dev-data-fix] Device updated: ${updatedTargetDevice.deviceId} -> siteId=${updatedTargetDevice.siteId}`
    );

    console.log('[dev-data-fix] Assigning siteId to remaining devices without siteId...');
    const allDevices = await prisma.device.updateMany({
      where: { siteId: null },
      data: { siteId: site.id },
    });
    console.log(`[dev-data-fix] Total additional devices updated: ${allDevices.count}`);

    console.log('[dev-data-fix] Resolving existing expired/stuck QUEUED commands...');
    const expiredStuck = await prisma.faucetCommand.updateMany({
      where: {
        status: 'QUEUED',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
        failureReasonCode: 'EXPIRED_COMMAND',
      },
    });
    console.log(`[dev-data-fix] Expired QUEUED commands resolved: ${expiredStuck.count}`);

    const remainingQueued = await prisma.faucetCommand.count({
      where: { status: 'QUEUED' },
    });
    console.log(`[dev-data-fix] Active QUEUED commands remaining in DB: ${remainingQueued}`);
  } catch (error) {
    console.error('[dev-data-fix] Error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
