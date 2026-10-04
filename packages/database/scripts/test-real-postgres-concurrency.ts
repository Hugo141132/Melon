import { execSync } from 'child_process';
import crypto from 'crypto';
import net from 'net';
import path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';
import { RetentionService } from '../src/retention-service';

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

function run(cmd: string, env: Record<string, string> = {}) {
  execSync(cmd, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
  });
}

async function verifyRealPostgres() {
  const nonce = crypto.randomBytes(6).toString('hex');
  const dbUser = 'test_user_' + nonce;
  const dbPass = 'test_pass_' + crypto.randomBytes(12).toString('hex');
  const dbName = 'kebun_melon_concurrency_test_' + nonce;
  const containerName = 'kebun_melon_concurrency_pg_' + nonce;

  const port = await getAvailablePort();
  const testDbUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${port}/${dbName}?schema=public`;

  console.log(`[START] Disposable PostgreSQL 15 Container on port ${port}...`);
  run(
    `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${port}:5432 postgres:15-alpine`
  );

  try {
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        execSync(`docker exec ${containerName} pg_isready -U ${dbUser}`, { stdio: 'pipe' });
        ready = true;
        break;
      } catch {
        execSync('node -e "setTimeout(() => {}, 500)"');
      }
    }
    if (!ready) throw new Error('Postgres container readiness timeout');

    console.log('[MIGRATE] Applying schema migrations...');
    run(`npx prisma migrate deploy --schema=prisma/schema.prisma`, {
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
    });

    const prisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    await prisma.$connect();
    const repo = new TelemetryRepository(prisma);
    const retentionService = new RetentionService(prisma);

    console.log('[SETUP] Creating 2 test devices...');
    const dev1 = await prisma.device.create({
      data: {
        deviceId: 'tank-node-01',
        name: 'Reservoir Tank 1',
        deviceType: 'WATER_TANK_NODE',
        accountStatus: 'ACTIVE',
      },
    });

    const dev2 = await prisma.device.create({
      data: {
        deviceId: 'tank-node-02',
        name: 'Reservoir Tank 2',
        deviceType: 'WATER_TANK_NODE',
        accountStatus: 'ACTIVE',
      },
    });

    // TEST 1: Fewer than 5 rows behavior
    console.log('[TEST 1] Ingesting 3 readings for dev1 (fewer than 5 rows)...');
    for (let i = 1; i <= 3; i++) {
      await repo.ingestReservoirReading({
        deviceId: dev1.deviceId,
        messageId: `msg-1-0${i}`,
        tankVolume: 100 + i,
      });
    }
    let dev1Count = await prisma.reservoirWaterReading.count({ where: { deviceId: dev1.id } });
    if (dev1Count !== 3) throw new Error(`Expected 3 rows, got ${dev1Count}`);
    console.log('✓ Fewer than 5 rows correctly retained all 3 rows.');

    // TEST 2: Concurrent same-device ingestion (10 parallel writes to dev1)
    console.log('[TEST 2] Executing 10 concurrent writes to dev1...');
    const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
      repo.ingestReservoirReading({
        deviceId: dev1.deviceId,
        messageId: `msg-concurrent-${i + 1}`,
        tankVolume: 200 + i,
      })
    );
    await Promise.all(concurrentPromises);

    dev1Count = await prisma.reservoirWaterReading.count({ where: { deviceId: dev1.id } });
    if (dev1Count !== 5) {
      throw new Error(`Concurrency violation! Expected exactly 5 rows, got ${dev1Count}`);
    }
    console.log('✓ Concurrent writes to same device serialized cleanly; retained exactly 5 rows.');

    // TEST 3: Two-device isolation
    console.log('[TEST 3] Ingesting 5 readings for dev2 and checking dev1 count...');
    for (let i = 1; i <= 5; i++) {
      await repo.ingestReservoirReading({
        deviceId: dev2.deviceId,
        messageId: `msg-dev2-${i}`,
        tankVolume: 500 + i,
      });
    }
    const dev2Count = await prisma.reservoirWaterReading.count({ where: { deviceId: dev2.id } });
    dev1Count = await prisma.reservoirWaterReading.count({ where: { deviceId: dev1.id } });
    if (dev1Count !== 5 || dev2Count !== 5) {
      throw new Error(`Device isolation failed: dev1 has ${dev1Count}, dev2 has ${dev2Count}`);
    }
    console.log('✓ Two-device isolation verified: both dev1 and dev2 independently retain 5 rows.');

    // TEST 4: Equal timestamps and deterministic tie-breaker (id desc)
    console.log('[TEST 4] Testing equal receivedAt timestamps...');
    const fixedTime = new Date('2026-10-04T12:00:00.000Z');
    // Clear dev2 for controlled ordering test
    await prisma.reservoirWaterReading.deleteMany({ where: { deviceId: dev2.id } });

    // Explicitly define ordered UUIDs so UUID order is known and deterministic
    // id6 > id5 > id4 > id3 > id2 > id1
    const testIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000006',
    ];

    for (let i = 0; i < 6; i++) {
      await prisma.reservoirWaterReading.create({
        data: {
          id: testIds[i],
          deviceId: dev2.id,
          messageId: `fixed-time-${i + 1}`,
          receivedAt: fixedTime,
          tankVolume: new Prisma.Decimal(10 * (i + 1)),
          schemaVersion: '1.0',
        },
      });
    }
    // Now prune using pruneExcessReservoirReadings
    await repo.pruneExcessReservoirReadings(5);
    const dev2Rows = await prisma.reservoirWaterReading.findMany({
      where: { deviceId: dev2.id },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });
    if (dev2Rows.length !== 5) throw new Error(`Expected 5 rows, got ${dev2Rows.length}`);
    // Check that message with id 00000000-0000-0000-0000-000000000001 was deleted because it had the lowest id
    const hasLowestId = dev2Rows.some((r) => r.id === testIds[0]);
    if (hasLowestId) throw new Error('Tie breaker failed; lowest id was not pruned');
    console.log('✓ Equal timestamps resolved deterministically using id desc.');

    // TEST 5: Duplicate replay within active window vs after pruning
    console.log('[TEST 5] Testing duplicate replay behavior...');
    // Clear dev2 readings to start fresh for replay test
    await prisma.reservoirWaterReading.deleteMany({ where: { deviceId: dev2.id } });

    // Ingest msg-active
    const ing1 = await repo.ingestReservoirReading({
      deviceId: dev2.deviceId,
      messageId: 'msg-active',
      tankVolume: 999,
    });
    if (ing1.isDuplicate) throw new Error('Expected initial ingestion to not be duplicate');

    // Replay same messageId immediately
    let ing2;
    try {
      ing2 = await repo.ingestReservoirReading({
        deviceId: dev2.deviceId,
        messageId: 'msg-active',
        tankVolume: 999,
      });
      console.log('ing2 result:', ing2);
    } catch (e: any) {
      console.log('ing2 threw error:', e);
      throw e;
    }
    if (!ing2.isDuplicate) throw new Error('Expected immediate replay to report isDuplicate=true');
    console.log(
      '✓ Duplicate within active 5-row window correctly detected and rejected idempotently.'
    );

    // Push 5 newer messages to evict 'msg-active'
    for (let i = 1; i <= 5; i++) {
      await repo.ingestReservoirReading({
        deviceId: dev2.deviceId,
        messageId: `evict-${i}`,
        tankVolume: 1000 + i,
      });
    }
    const activeMsgCheck = await prisma.reservoirWaterReading.findUnique({
      where: { deviceId_messageId: { deviceId: dev2.id, messageId: 'msg-active' } },
    });
    if (activeMsgCheck !== null) throw new Error('msg-active should have been pruned');

    // Now replay 'msg-active' after pruning
    const ingPrunedReplay = await repo.ingestReservoirReading({
      deviceId: dev2.deviceId,
      messageId: 'msg-active',
      tankVolume: 999,
    });
    // Documented behavior: Since msg-active was deleted from active rows, DB accepts it as new row
    if (ingPrunedReplay.isDuplicate)
      throw new Error('Expected pruned replay to be accepted since row was pruned');
    console.log(
      '✓ Replay of pruned message accepted cleanly as new arrival (per documented active-window constraint).'
    );

    // TEST 6: RetentionService background cleaner
    console.log(
      '[TEST 6] Testing RetentionService background cleaner on reservoir_water_readings...'
    );
    // Seed 10 raw rows for dev1
    for (let i = 100; i < 110; i++) {
      await prisma.reservoirWaterReading.create({
        data: {
          deviceId: dev1.id,
          messageId: `batch-seed-${i}`,
          receivedAt: new Date(Date.now() - (110 - i) * 1000),
          tankVolume: new Prisma.Decimal(i),
          schemaVersion: '1.0',
        },
      });
    }
    const beforeCleanCount = await prisma.reservoirWaterReading.count({
      where: { deviceId: dev1.id },
    });
    if (beforeCleanCount <= 5) throw new Error('Should have >5 rows for background test');
    const cleanSummary = await retentionService.pruneExpiredTelemetry({
      tables: ['reservoir_water_readings'],
      batchSize: 10,
    });
    const afterCleanCount = await prisma.reservoirWaterReading.count({
      where: { deviceId: dev1.id },
    });
    if (afterCleanCount !== 5) {
      throw new Error(`RetentionService cleanup failed: expected 5 rows, got ${afterCleanCount}`);
    }
    const deleted = cleanSummary.tables.reservoir_water_readings.deletedCount;
    console.log(`✓ RetentionService cleaned ${deleted} excess rows, leaving exactly 5 rows.`);

    await prisma.$disconnect();
    console.log('\n========================================');
    console.log('ALL REAL-POSTGRESQL CONCURRENCY & PRUNING TESTS PASSED!');
    console.log('========================================\n');
  } finally {
    console.log(`[CLEANUP] Stopping and removing container ${containerName}...`);
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    } catch {}
  }
}

verifyRealPostgres().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
