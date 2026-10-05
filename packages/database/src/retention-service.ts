import { PrismaClient } from '@prisma/client';

export type ApprovedRetentionTable =
  | 'soil_readings'
  | 'water_readings'
  | 'reservoir_water_readings'
  | 'sensor_battery_readings'
  | 'device_status_events'
  | 'integration_errors'
  | 'faucet_commands';

export const APPROVED_RETENTION_TABLES: readonly ApprovedRetentionTable[] = [
  'soil_readings',
  'water_readings',
  'reservoir_water_readings',
  'sensor_battery_readings',
  'device_status_events',
  'integration_errors',
  'faucet_commands',
] as const;

export const PROTECTED_EXEMPT_TABLES: readonly string[] = [
  'audit_logs',
  'account_approvals',
  'users',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'devices',
  'device_capabilities',
  'user_device_access',
  'sites',
  'alerts',
  'alert_acknowledgements',
  'user_preferences',
  'sessions',
  'password_reset_tokens',
  'email_verification_tokens',
] as const;

/**
 * Calculates 3-calendar-month UTC cutoff date with month-end day clamping.
 * Prevents JavaScript Date month overflow (e.g. May 31 -> Feb 28/29 instead of March 3).
 */
export function calculateThreeMonthUtcCutoff(referenceDate: Date = new Date()): Date {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();
  const hours = referenceDate.getUTCHours();
  const minutes = referenceDate.getUTCMinutes();
  const seconds = referenceDate.getUTCSeconds();
  const ms = referenceDate.getUTCMilliseconds();

  const targetMonth = month - 3;
  const maxDaysInTargetMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDaysInTargetMonth);

  return new Date(Date.UTC(year, targetMonth, clampedDay, hours, minutes, seconds, ms));
}

export class UnapprovedRetentionTableError extends Error {
  constructor(public readonly tableName: string) {
    super(
      `Cannot purge table '${tableName}': table is protected or not approved for telemetry retention.`
    );
    this.name = 'UnapprovedRetentionTableError';
  }
}

export interface RetentionOptions {
  /**
   * Number of days to retain raw telemetry data.
   * Records with receivedAt older than (now - retentionDays) will be purged.
   * @default 90
   */
  retentionDays?: number;

  /**
   * Maximum number of rows deleted per single batch iteration.
   * @default 1000
   */
  batchSize?: number;

  /**
   * Pause in milliseconds between chunked batch iterations to yield database locks.
   * @default 20
   */
  yieldMs?: number;

  /**
   * Subset of approved tables to prune. Must be from APPROVED_RETENTION_TABLES.
   * @default all APPROVED_RETENTION_TABLES
   */
  tables?: ApprovedRetentionTable[];

  /**
   * Reference anchor date for retention cutoff calculation.
   * @default new Date()
   */
  now?: Date;
}

export interface TableRetentionResult {
  table: ApprovedRetentionTable;
  deletedCount: number;
  batchesExecuted: number;
  durationMs: number;
}

export interface RetentionSummary {
  cutoffDate: Date;
  commandCutoffDate?: Date;
  retentionDays: number;
  totalDeleted: number;
  tables: Record<ApprovedRetentionTable, TableRetentionResult>;
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
}

/**
 * Service responsible for executing bounded, chunked retention cleanup
 * on high-frequency telemetry and diagnostic operational tables.
 */
export class RetentionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Purges expired records across all approved telemetry tables using chunked batch deletion.
   */
  async pruneExpiredTelemetry(options: RetentionOptions = {}): Promise<RetentionSummary> {
    const startedAt = new Date();
    const retentionDays = options.retentionDays ?? 90;
    const batchSize = Math.max(1, Math.min(options.batchSize ?? 1000, 10000));
    const yieldMs = Math.max(0, options.yieldMs ?? 20);
    const referenceNow = options.now ?? startedAt;

    if (options.tables !== undefined && options.tables.length === 0) {
      throw new Error(
        'options.tables cannot be explicitly empty. Omit to target all approved tables or specify valid tables.'
      );
    }

    const defaultCutoffDate = new Date(
      referenceNow.getTime() - retentionDays * 24 * 60 * 60 * 1000
    );
    const threeMonthCutoffDate = calculateThreeMonthUtcCutoff(referenceNow);
    const targetTables = options.tables ?? APPROVED_RETENTION_TABLES;

    // Validate that all target tables are strictly approved
    for (const table of targetTables) {
      if (!APPROVED_RETENTION_TABLES.includes(table)) {
        throw new UnapprovedRetentionTableError(table);
      }
    }

    const tableResults: Partial<Record<ApprovedRetentionTable, TableRetentionResult>> = {};
    let totalDeleted = 0;

    for (const table of targetTables) {
      // Enforce 3 calendar months with UTC month-end clamping for faucet_commands
      // regardless of retentionDays or whether selected tables are command-only or mixed.
      const tableCutoffDate =
        table === 'faucet_commands'
          ? threeMonthCutoffDate
          : options.retentionDays !== undefined
            ? new Date(referenceNow.getTime() - options.retentionDays * 24 * 60 * 60 * 1000)
            : defaultCutoffDate;

      const tableStart = Date.now();
      const { deletedCount, batchesExecuted } = await this.pruneTableInBatches(
        table,
        tableCutoffDate,
        batchSize,
        yieldMs
      );

      const durationMs = Date.now() - tableStart;
      tableResults[table] = {
        table,
        deletedCount,
        batchesExecuted,
        durationMs,
      };
      totalDeleted += deletedCount;
    }

    // Ensure all approved tables are present in results (0 for unselected)
    for (const approved of APPROVED_RETENTION_TABLES) {
      if (!tableResults[approved]) {
        tableResults[approved] = {
          table: approved,
          deletedCount: 0,
          batchesExecuted: 0,
          durationMs: 0,
        };
      }
    }

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();
    const isCommandOnly =
      targetTables.length === 1 && targetTables[0] === 'faucet_commands';
    const cutoffDate = isCommandOnly ? threeMonthCutoffDate : defaultCutoffDate;

    return {
      cutoffDate,
      commandCutoffDate: threeMonthCutoffDate,
      retentionDays,
      totalDeleted,
      tables: tableResults as Record<ApprovedRetentionTable, TableRetentionResult>,
      startedAt,
      completedAt,
      totalDurationMs,
    };
  }

  /**
   * Prunes a single approved table in chunked batches.
   */
  private async pruneTableInBatches(
    table: ApprovedRetentionTable,
    cutoffDate: Date,
    batchSize: number,
    yieldMs: number
  ): Promise<{ deletedCount: number; batchesExecuted: number }> {
    let deletedCount = 0;
    let batchesExecuted = 0;
    let hasMore = true;

    while (hasMore) {
      const idsToDelete = await this.fetchBatchIds(table, cutoffDate, batchSize);
      if (idsToDelete.length === 0) {
        hasMore = false;
        break;
      }

      const count = await this.deleteByIds(table, idsToDelete);
      deletedCount += count;
      batchesExecuted += 1;

      if (idsToDelete.length < batchSize) {
        // Last batch reached
        hasMore = false;
        break;
      }

      if (yieldMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, yieldMs));
      }
    }

    return { deletedCount, batchesExecuted };
  }

  private async fetchBatchIds(
    table: ApprovedRetentionTable,
    cutoffDate: Date,
    batchSize: number
  ): Promise<string[]> {
    switch (table) {
      case 'soil_readings': {
        const rows = await this.prisma.soilReading.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'water_readings': {
        const rows = await this.prisma.waterReading.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'reservoir_water_readings': {
        // Enforce deterministic latest-5 per device retention (DEC-MON-092 / TASK-0917)
        if (typeof (this.prisma as any).$queryRaw === 'function') {
          const rows = await (this.prisma as any).$queryRaw<{ id: string }[]>`
            SELECT id FROM (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY device_id
                       ORDER BY received_at DESC, id DESC
                     ) as rn
              FROM "reservoir_water_readings"
            ) sub
            WHERE sub.rn > 5
            LIMIT ${batchSize}
          `;
          return rows.map((r: { id: string }) => r.id);
        }
        const rows = await this.prisma.reservoirWaterReading.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'sensor_battery_readings': {
        const rows = await this.prisma.sensorBatteryReading.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'device_status_events': {
        const rows = await this.prisma.deviceStatusEvent.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'integration_errors': {
        const rows = await this.prisma.integrationError.findMany({
          where: { receivedAt: { lt: cutoffDate } },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      case 'faucet_commands': {
        const rows = await this.prisma.faucetCommand.findMany({
          where: {
            status: {
              in: ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'],
            },
            OR: [
              { completedAt: { not: null, lt: cutoffDate } },
              { failedAt: { not: null, lt: cutoffDate } },
              { cancelledAt: { not: null, lt: cutoffDate } },
              {
                status: { in: ['TIMEOUT', 'EXPIRED'] },
                expiresAt: { lt: cutoffDate },
              },
              {
                completedAt: null,
                failedAt: null,
                cancelledAt: null,
                updatedAt: { lt: cutoffDate },
              },
            ],
          },
          select: { id: true },
          take: batchSize,
        });
        return rows.map((r) => r.id);
      }
      default:
        throw new UnapprovedRetentionTableError(table);
    }
  }

  private async deleteByIds(table: ApprovedRetentionTable, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    switch (table) {
      case 'soil_readings': {
        const res = await this.prisma.soilReading.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'water_readings': {
        const res = await this.prisma.waterReading.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'reservoir_water_readings': {
        const res = await this.prisma.reservoirWaterReading.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'sensor_battery_readings': {
        const res = await this.prisma.sensorBatteryReading.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'device_status_events': {
        const res = await this.prisma.deviceStatusEvent.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'integration_errors': {
        const res = await this.prisma.integrationError.deleteMany({
          where: { id: { in: ids } },
        });
        return res.count;
      }
      case 'faucet_commands': {
        return await this.prisma.$transaction(async (tx) => {
          const cmds = await tx.faucetCommand.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              commandId: true,
              deviceId: true,
              idempotencyKey: true,
              status: true,
              requestedAt: true,
            },
          });

          if (cmds.length === 0) return 0;

          const tombstoneData = cmds.map((c) => ({
            idempotencyKey: c.idempotencyKey,
            commandId: c.commandId,
            deviceId: c.deviceId,
            originalStatus: c.status,
            requestedAt: c.requestedAt,
            purgedAt: new Date(),
          }));

          if ((tx as any).faucetCommandIdempotencyTombstone?.createMany) {
            await (tx as any).faucetCommandIdempotencyTombstone.createMany({
              data: tombstoneData,
              skipDuplicates: true,
            });
          }

          await tx.faucetCommandEvent.deleteMany({
            where: { faucetCommandId: { in: ids } },
          });

          const res = await tx.faucetCommand.deleteMany({
            where: { id: { in: ids } },
          });

          return res.count;
        });
      }
      default:
        throw new UnapprovedRetentionTableError(table);
    }
  }
}
