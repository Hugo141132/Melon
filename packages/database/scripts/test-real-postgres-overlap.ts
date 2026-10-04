import { execSync } from 'child_process';
import crypto from 'crypto';
import net from 'net';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';
import { RetentionService } from '../src/retention-service';

/**
 * TASK-0917 / DEC-MON-092: overlapping ingestion + maintenance on real PostgreSQL.
 * Uses the real TelemetryRepository.ingestReservoirReading and
 * RetentionService.pruneExpiredTelemetry paths, started simultaneously.
 *
 * PG_IMAGE defaults to postgres:17-alpine (deployed Supabase major is 17).
 */
const PG_IMAGE = process.env.PG_IMAGE || 'postgres:17-alpine';
const ROUNDS = 6;
const SEED_EXCESS_PER_DEVICE = 250;
const INGESTS_PER_DEVICE = 10;
const MAINTENANCE_RUNS = 4;

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

type IngestOk = { readingId: string; receivedAt: Date };

function expectedTop5(rows: IngestOk[]): string[] {
  return [...rows]
    .sort((a, b) => {
      const t = b.receivedAt.getTime() - a.receivedAt.getTime();
      if (t !== 0) return t;
      return a.readingId < b.readingId ? 1 : a.readingId > b.readingId ? -1 : 0;
    })
    .slice(0, 5)
    .map((r) => r.readingId);
}

async function main() {
  const nonce = crypto.randomBytes(6).toString('hex');
  const dbUser = 'test_user_' + nonce;
  const dbPass = 'test_pass_' + crypto.randomBytes(12).toString('hex');
  const dbName = 'kebun_melon_overlap_test_' + nonce;
  const containerName = 'kebun_melon_overlap_pg_' + nonce;
  const port = await getAvailablePort();
  const url = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${port}/${dbName}?schema=public`;

  console.log(`[START] ${PG_IMAGE} on port ${port}`);
  run(
    `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${port}:5432 ${PG_IMAGE}`
  );

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        execSync(`docker exec ${containerName} pg_isready -U ${dbUser} -d ${dbName}`, {
          stdio: 'pipe',
        });
        // Alpine image restarts once after init; require two consecutive successes
        execSync('node -e "setTimeout(() => {}, 1500)"');
        execSync(`docker exec ${containerName} pg_isready -U ${dbUser} -d ${dbName}`, {
          stdio: 'pipe',
        });
        ready = true;
        break;
      } catch {
        execSync('node -e "setTimeout(() => {}, 500)"');
      }
    }
    assert(ready, 'postgres readiness timeout');

    run(`npx prisma migrate deploy --schema=prisma/schema.prisma`, {
      DATABASE_URL: url,
      DIRECT_URL: url,
    });

    const prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    const [{ server_version }] = await prisma.$queryRaw<
      { server_version: string }[]
    >`SHOW server_version`;
    console.log(`[PG] server_version=${server_version}`);

    const repo = new TelemetryRepository(prisma);
    const retention = new RetentionService(prisma);

    const mk = (n: string) =>
      prisma.device.create({
        data: { deviceId: n, name: n, deviceType: 'WATER_TANK_NODE', accountStatus: 'ACTIVE' },
      });
    const devA = await mk('overlap-tank-A');
    const devB = await mk('overlap-tank-B');
    const devices = [devA, devB];

    for (let round = 1; round <= ROUNDS; round++) {
      // Seed old excess rows so maintenance and ingestion both have deletion work.
      for (const d of devices) {
        await prisma.reservoirWaterReading.createMany({
          data: Array.from({ length: SEED_EXCESS_PER_DEVICE }, (_, i) => ({
            deviceId: d.id,
            messageId: `seed-r${round}-${d.deviceId}-${i}`,
            receivedAt: new Date(Date.now() - 3_600_000 + i * 10),
            schemaVersion: '1.0',
          })),
        });
      }

      const ingestJobs = devices.flatMap((d) =>
        Array.from({ length: INGESTS_PER_DEVICE }, (_, i) => ({
          device: d,
          p: repo.ingestReservoirReading({
            deviceId: d.deviceId,
            messageId: `live-r${round}-${d.deviceId}-${i}`,
            tankVolume: 100 + i,
          }),
        }))
      );
      const maintenanceJobs = Array.from({ length: MAINTENANCE_RUNS }, () =>
        retention.pruneExpiredTelemetry({
          tables: ['reservoir_water_readings'],
          batchSize: 25,
          yieldMs: 0,
        })
      );

      const settled = await Promise.allSettled([...ingestJobs.map((j) => j.p), ...maintenanceJobs]);
      const failures = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
      assert(
        failures.length === 0,
        `transaction failures: ${failures.map((f) => String(f.reason)).join(' | ')}`
      );

      // Settle: one more maintenance pass after all ingests committed
      await retention.pruneExpiredTelemetry({
        tables: ['reservoir_water_readings'],
        batchSize: 25,
        yieldMs: 0,
      });

      for (const d of devices) {
        const ingested: IngestOk[] = [];
        settled.slice(0, ingestJobs.length).forEach((s, idx) => {
          if (ingestJobs[idx].device.id === d.id && s.status === 'fulfilled') {
            const v = s.value as { readingId: string; receivedAt: Date; isDuplicate: boolean };
            assert(!v.isDuplicate, 'unexpected duplicate for unique live messageId');
            ingested.push({ readingId: v.readingId, receivedAt: v.receivedAt });
          }
        });
        assert(ingested.length === INGESTS_PER_DEVICE, 'all ingests must succeed');

        const retained = await prisma.reservoirWaterReading.findMany({
          where: { deviceId: d.id },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        const retainedIds = retained.map((r) => r.id);
        const expected = expectedTop5(ingested);
        assert(
          retainedIds.length === 5,
          `round ${round} ${d.deviceId}: expected cap 5, got ${retainedIds.length}`
        );
        assert(
          JSON.stringify(retainedIds) === JSON.stringify(expected),
          `round ${round} ${d.deviceId}: retained IDs differ.\n got=${retainedIds}\n exp=${expected}`
        );
        const latest = await repo.getLatestWaterTankReading(d.deviceId);
        assert(latest?.id === expected[0], `round ${round} ${d.deviceId}: latest reading mismatch`);
      }
      console.log(
        `✓ round ${round}/${ROUNDS}: no failures, cap=5 per device, retained IDs == expected latest 5`
      );
    }

    await new Promise((r) => setTimeout(r, 2000)); // allow pg stats flush
    const [{ deadlocks }] = await prisma.$queryRaw<{ deadlocks: bigint }[]>`
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
    console.log(`[PG] pg_stat_database.deadlocks=${deadlocks}`);
    assert(Number(deadlocks) === 0, 'PostgreSQL recorded deadlocks');

    await prisma.$disconnect();
    console.log('\nOVERLAP TEST PASSED (ingestion + maintenance concurrent, real PostgreSQL)');
  } finally {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    } catch {}
  }
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
