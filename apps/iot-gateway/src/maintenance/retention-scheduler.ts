import { PrismaClient } from '@prisma/client';
import { RetentionService, RetentionSummary, RetentionOptions } from '@kebun-melon/database';
import { GatewayEnv } from '../config/env';
import { logger } from '../observability/logger';

export interface RetentionSchedulerOptions {
  env: GatewayEnv;
  prisma?: PrismaClient;
  retentionService?: RetentionService;
}

export class RetentionScheduler {
  private timer: NodeJS.Timeout | null = null;
  private initialBootTimeout: NodeJS.Timeout | null = null;
  private isJobRunning = false;
  private retentionService?: RetentionService;
  private readonly env: GatewayEnv;
  private readonly prisma?: PrismaClient;

  constructor(options: RetentionSchedulerOptions) {
    this.env = options.env;
    this.retentionService = options.retentionService;
    this.prisma = options.prisma;
  }

  private getService(): RetentionService {
    if (!this.retentionService) {
      const prisma = this.prisma ?? new PrismaClient();
      this.retentionService = new RetentionService(prisma);
    }
    return this.retentionService;
  }

  /**
   * Starts the recurring background retention timer.
   */
  start(): void {
    if (this.timer) {
      return;
    }

    if (!this.env.RETENTION_ENABLED) {
      logger.info('Telemetry retention scheduler is disabled via configuration.');
      return;
    }

    const intervalMs = this.env.RETENTION_INTERVAL_MS ?? 86400000;
    logger.info('Starting telemetry retention scheduler...', {
      retentionDays: this.env.RETENTION_RAW_DAYS ?? 90,
      batchSize: this.env.RETENTION_BATCH_SIZE ?? 1000,
      intervalMs,
    });

    // Schedule periodic retention runs
    this.timer = setInterval(() => {
      this.runRetentionJob().catch((err) => {
        logger.error('Unhandled error in scheduled retention job', err);
      });
    }, intervalMs);

    // Run initial run asynchronously shortly after boot (e.g. 10s delay to allow initial connections)
    this.initialBootTimeout = setTimeout(() => {
      this.runRetentionJob().catch((err) => {
        logger.error('Unhandled error in initial boot retention run', err);
      });
    }, 10000);
  }

  /**
   * Stops the background retention timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.initialBootTimeout) {
      clearTimeout(this.initialBootTimeout);
      this.initialBootTimeout = null;
    }
    logger.info('Telemetry retention scheduler stopped.');
  }

  /**
   * Executes a single retention purge cycle.
   */
  async runRetentionJob(
    overrideOptions?: Partial<RetentionOptions>
  ): Promise<RetentionSummary | null> {
    if (this.isJobRunning) {
      logger.warn('Retention job is already in progress, skipping concurrent trigger.');
      return null;
    }

    this.isJobRunning = true;
    try {
      const options: RetentionOptions = {
        retentionDays: overrideOptions?.retentionDays ?? this.env.RETENTION_RAW_DAYS ?? 90,
        batchSize: overrideOptions?.batchSize ?? this.env.RETENTION_BATCH_SIZE ?? 1000,
        yieldMs: overrideOptions?.yieldMs ?? 20,
        ...overrideOptions,
      };

      logger.info('Executing telemetry data retention cleanup...', {
        retentionDays: options.retentionDays,
        batchSize: options.batchSize,
      });

      const summary = await this.getService().pruneExpiredTelemetry(options);

      logger.info('Telemetry data retention cleanup completed successfully.', {
        totalDeleted: summary.totalDeleted,
        retentionDays: summary.retentionDays,
        cutoffDate: summary.cutoffDate.toISOString(),
        totalDurationMs: summary.totalDurationMs,
        tables: summary.tables,
      });

      return summary;
    } catch (error: any) {
      logger.error('Telemetry data retention cleanup failed', {
        error: error?.message ?? String(error),
        stack: error?.stack,
      });
      throw error;
    } finally {
      this.isJobRunning = false;
    }
  }
}
