import { PrismaClient } from '@prisma/client';

export type ApprovedRetentionTable =
  | 'soil_readings'
  | 'water_readings'
  | 'reservoir_water_readings'
  | 'sensor_battery_readings'
  | 'device_status_events'
  | 'integration_errors';

export const APPROVED_RETENTION_TABLES: readonly ApprovedRetentionTable[] = [
  'soil_readings',
  'water_readings',
  'reservoir_water_readings',
  'sensor_battery_readings',
  'device_status_events',
  'integration_errors',
] as const;

export const PROTECTED_EXEMPT_TABLES: readonly string[] = [
  'audit_logs',
  'faucet_commands',
  'faucet_command_events',
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

    const cutoffDate = new Date(referenceNow.getTime() - retentionDays * 24 * 60 * 60 * 1000);
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
      const tableStart = Date.now();
      const { deletedCount, batchesExecuted } = await this.pruneTableInBatches(
        table,
        cutoffDate,
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

    return {
      cutoffDate,
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
      default:
        throw new UnapprovedRetentionTableError(table);
    }
  }
}
