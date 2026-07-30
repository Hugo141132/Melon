import { PrismaClient } from '@prisma/client';
import { DeviceRepository } from '../src/device-repository';

async function runOneTimeReconciliation() {
  const prisma = new PrismaClient();
  const repo = new DeviceRepository(prisma);

  console.log('--- BEFORE RECONCILIATION ---');
  const beforeObsolete = await prisma.deviceCapability.findMany({
    where: { capability: { in: ['RELAY_CONTROL', 'SOLENOID_VALVE_CONTROL'] } },
    select: { id: true, deviceId: true, capability: true },
  });
  console.log('Obsolete rows before reconciliation:', beforeObsolete.length, beforeObsolete);

  console.log('Executing controlled one-time reconciliation...');
  const result = await repo.reconcileExistingDeviceCapabilitiesOnce();
  console.log('Reconciled device count:', result.reconciledDeviceCount);

  console.log('--- AFTER RECONCILIATION ---');
  const afterObsolete = await prisma.deviceCapability.findMany({
    where: { capability: { in: ['RELAY_CONTROL', 'SOLENOID_VALVE_CONTROL'] } },
  });
  console.log('Obsolete rows count after reconciliation:', afterObsolete.length);

  const waterTankCaps = await prisma.deviceCapability.findMany({
    where: { device: { deviceType: 'WATER_TANK_NODE' } },
    select: { capability: true, enabled: true, source: true },
  });
  console.log('Water Tank Node capabilities after reconciliation:', waterTankCaps);

  await prisma.$disconnect();
}

runOneTimeReconciliation().catch((err) => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
