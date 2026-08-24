import { PrismaClient } from '@prisma/client';
import { RetentionService, RetentionOptions } from '@kebun-melon/database';

async function main() {
  const prisma = new PrismaClient();
  const retentionService = new RetentionService(prisma);

  const retentionDays = process.env.RETENTION_RAW_DAYS
    ? parseInt(process.env.RETENTION_RAW_DAYS, 10)
    : 90;
  const batchSize = process.env.RETENTION_BATCH_SIZE
    ? parseInt(process.env.RETENTION_BATCH_SIZE, 10)
    : 1000;

  console.log(`[Retention CLI] Starting telemetry retention cleanup...`);
  console.log(
    `[Retention CLI] Configuration: retentionDays=${retentionDays}, batchSize=${batchSize}`
  );

  try {
    const summary = await retentionService.pruneExpiredTelemetry({
      retentionDays,
      batchSize,
      yieldMs: 10,
    });

    console.log(`[Retention CLI] Cleanup completed successfully.`);
    console.log(`[Retention CLI] Cutoff Date: ${summary.cutoffDate.toISOString()}`);
    console.log(`[Retention CLI] Total records purged: ${summary.totalDeleted}`);
    console.log(`[Retention CLI] Duration: ${summary.totalDurationMs} ms`);
    console.table(
      Object.entries(summary.tables).map(([table, res]) => ({
        Table: table,
        'Deleted Count': res.deletedCount,
        'Batches Executed': res.batchesExecuted,
        'Duration (ms)': res.durationMs,
      }))
    );

    process.exit(0);
  } catch (error) {
    console.error(`[Retention CLI] Cleanup failed:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
