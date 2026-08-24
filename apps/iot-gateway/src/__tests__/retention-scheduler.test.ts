import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetentionScheduler } from '../maintenance/retention-scheduler';
import { GatewayEnv } from '../config/env';

describe('RetentionScheduler Unit Tests', () => {
  let mockRetentionService: any;
  let mockEnv: GatewayEnv;

  beforeEach(() => {
    vi.useFakeTimers();

    mockRetentionService = {
      pruneExpiredTelemetry: vi.fn().mockResolvedValue({
        cutoffDate: new Date('2026-05-26T00:00:00.000Z'),
        retentionDays: 90,
        totalDeleted: 150,
        tables: {
          soil_readings: {
            table: 'soil_readings',
            deletedCount: 100,
            batchesExecuted: 1,
            durationMs: 10,
          },
          water_readings: {
            table: 'water_readings',
            deletedCount: 50,
            batchesExecuted: 1,
            durationMs: 5,
          },
          reservoir_water_readings: {
            table: 'reservoir_water_readings',
            deletedCount: 0,
            batchesExecuted: 0,
            durationMs: 0,
          },
          sensor_battery_readings: {
            table: 'sensor_battery_readings',
            deletedCount: 0,
            batchesExecuted: 0,
            durationMs: 0,
          },
          device_status_events: {
            table: 'device_status_events',
            deletedCount: 0,
            batchesExecuted: 0,
            durationMs: 0,
          },
          integration_errors: {
            table: 'integration_errors',
            deletedCount: 0,
            batchesExecuted: 0,
            durationMs: 0,
          },
        },
        startedAt: new Date('2026-08-24T10:00:00.000Z'),
        completedAt: new Date('2026-08-24T10:00:00.020Z'),
        totalDurationMs: 20,
      }),
    };

    mockEnv = {
      NODE_ENV: 'development',
      APP_ENV: 'development',
      PORT: 3001,
      HOST: '0.0.0.0',
      LOG_LEVEL: 'info',
      ENABLE_FAUCET_CONTROL: false,
      RATE_LIMIT_GATEWAY_MAX: 60,
      RATE_LIMIT_WINDOW_MS: 60000,
      RETENTION_ENABLED: true,
      RETENTION_RAW_DAYS: 90,
      RETENTION_BATCH_SIZE: 1000,
      RETENTION_INTERVAL_MS: 86400000,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Lifecycle and Configuration', () => {
    it('does not schedule job if RETENTION_ENABLED is false', () => {
      mockEnv.RETENTION_ENABLED = false;
      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      scheduler.start();
      vi.advanceTimersByTime(100000);

      expect(mockRetentionService.pruneExpiredTelemetry).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it('starts periodic timer and executes initial run when RETENTION_ENABLED is true', async () => {
      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      scheduler.start();

      // Fast-forward 10 seconds for initial boot run
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockRetentionService.pruneExpiredTelemetry).toHaveBeenCalledTimes(1);

      // Fast-forward full interval (24 hours)
      await vi.advanceTimersByTimeAsync(86400000);
      expect(mockRetentionService.pruneExpiredTelemetry).toHaveBeenCalledTimes(2);

      scheduler.stop();
    });

    it('stops periodic timer cleanly when stop() is called', async () => {
      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      scheduler.start();
      scheduler.stop();

      await vi.advanceTimersByTimeAsync(86400000 * 2);
      expect(mockRetentionService.pruneExpiredTelemetry).not.toHaveBeenCalled();
    });
  });

  describe('Execution Handling', () => {
    it('passes configured retentionDays and batchSize to retention service', async () => {
      mockEnv.RETENTION_RAW_DAYS = 60;
      mockEnv.RETENTION_BATCH_SIZE = 500;

      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      const summary = await scheduler.runRetentionJob();

      expect(mockRetentionService.pruneExpiredTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionDays: 60,
          batchSize: 500,
        })
      );
      expect(summary?.totalDeleted).toBe(150);
    });

    it('skips concurrent execution if a job is already in flight', async () => {
      let resolveJob: any;
      mockRetentionService.pruneExpiredTelemetry.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveJob = resolve;
          })
      );

      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      // Start first job (pending)
      const job1Promise = scheduler.runRetentionJob();

      // Trigger second concurrent job while first is still pending
      const job2Result = await scheduler.runRetentionJob();
      expect(job2Result).toBeNull();

      // Settle first job
      resolveJob({
        cutoffDate: new Date(),
        retentionDays: 90,
        totalDeleted: 0,
        tables: {},
        startedAt: new Date(),
        completedAt: new Date(),
        totalDurationMs: 0,
      });
      await job1Promise;

      // After settling, a new job can execute
      mockRetentionService.pruneExpiredTelemetry.mockResolvedValueOnce({
        cutoffDate: new Date(),
        retentionDays: 90,
        totalDeleted: 0,
        tables: {},
        startedAt: new Date(),
        completedAt: new Date(),
        totalDurationMs: 0,
      });
      const job3Result = await scheduler.runRetentionJob();
      expect(job3Result).not.toBeNull();
    });

    it('propagates and logs errors from retention service', async () => {
      mockRetentionService.pruneExpiredTelemetry.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const scheduler = new RetentionScheduler({
        env: mockEnv,
        retentionService: mockRetentionService,
      });

      await expect(scheduler.runRetentionJob()).rejects.toThrow('Database connection failed');
    });
  });
});
