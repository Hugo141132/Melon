import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetentionService,
  APPROVED_RETENTION_TABLES,
  PROTECTED_EXEMPT_TABLES,
  UnapprovedRetentionTableError,
  calculateThreeMonthUtcCutoff,
} from '../src/retention-service';

describe('RetentionService Unit Tests', () => {
  let mockPrisma: any;
  let retentionService: RetentionService;

  beforeEach(() => {
    mockPrisma = {
      soilReading: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      waterReading: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      reservoirWaterReading: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      sensorBatteryReading: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      deviceStatusEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      integrationError: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      faucetCommand: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      faucetCommandEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      faucetCommandIdempotencyTombstone: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      accountApproval: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((cb) => cb(mockPrisma)),
    };

    retentionService = new RetentionService(mockPrisma);
  });

  describe('Table Whitelisting and Safety', () => {
    it('defines exactly approved telemetry and operations tables', () => {
      expect(APPROVED_RETENTION_TABLES).toEqual([
        'soil_readings',
        'water_readings',
        'reservoir_water_readings',
        'sensor_battery_readings',
        'device_status_events',
        'integration_errors',
        'faucet_commands',
      ]);
    });

    it('identifies critical audit and safety tables as protected/exempt', () => {
      expect(PROTECTED_EXEMPT_TABLES).toContain('audit_logs');
      expect(PROTECTED_EXEMPT_TABLES).toContain('account_approvals');
    });

    it('rejects attempt to prune unapproved or protected table with UnapprovedRetentionTableError', async () => {
      await expect(
        retentionService.pruneExpiredTelemetry({
          tables: ['audit_logs' as any],
        })
      ).rejects.toThrow(UnapprovedRetentionTableError);

      // Verify no database methods called on auditLog
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Cutoff Date Calculation', () => {
    it('calculates 3-calendar-month UTC cutoff date accurately', () => {
      const fixedNow = new Date('2026-10-05T12:00:00.000Z');
      const cutoff = calculateThreeMonthUtcCutoff(fixedNow);
      expect(cutoff.toISOString()).toBe('2026-07-05T12:00:00.000Z');
    });

    it('clamps to month-end correctly when target month has fewer days (e.g. May 31 -> Feb 28/29)', () => {
      // 2026 is non-leap year (February has 28 days)
      const may31 = new Date('2026-05-31T15:30:00.000Z');
      const cutoff2026 = calculateThreeMonthUtcCutoff(may31);
      expect(cutoff2026.toISOString()).toBe('2026-02-28T15:30:00.000Z');

      // 2024 is leap year (February has 29 days)
      const may31Leap = new Date('2024-05-31T15:30:00.000Z');
      const cutoff2024 = calculateThreeMonthUtcCutoff(may31Leap);
      expect(cutoff2024.toISOString()).toBe('2024-02-29T15:30:00.000Z');

      // Year boundary (March 31 -> Dec 31)
      const march31 = new Date('2026-03-31T10:00:00.000Z');
      const cutoffYearBoundary = calculateThreeMonthUtcCutoff(march31);
      expect(cutoffYearBoundary.toISOString()).toBe('2025-12-31T10:00:00.000Z');
    });
    it('calculates 90-day cutoff date accurately by default', async () => {
      const fixedNow = new Date('2026-08-24T12:00:00.000Z');
      const expectedCutoff = new Date(fixedNow.getTime() - 90 * 24 * 60 * 60 * 1000);

      const summary = await retentionService.pruneExpiredTelemetry({
        now: fixedNow,
        yieldMs: 0,
      });

      expect(summary.cutoffDate).toEqual(expectedCutoff);
      expect(summary.retentionDays).toBe(90);
      expect(summary.totalDeleted).toBe(0);

      // Verify soilReading was queried with correct cutoff
      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledWith({
        where: { receivedAt: { lt: expectedCutoff } },
        select: { id: true },
        take: 1000,
      });
    });

    it('respects custom retentionDays parameter', async () => {
      const fixedNow = new Date('2026-08-24T12:00:00.000Z');
      const expectedCutoff = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000);

      const summary = await retentionService.pruneExpiredTelemetry({
        retentionDays: 30,
        now: fixedNow,
        yieldMs: 0,
      });

      expect(summary.cutoffDate).toEqual(expectedCutoff);
      expect(summary.retentionDays).toBe(30);
    });
  });

  describe('Chunked Batch Deletion', () => {
    it('deletes records across multiple batches until table is cleared', async () => {
      const fixedNow = new Date('2026-08-24T12:00:00.000Z');

      // Batch 1: returns 1000 IDs
      const batch1Ids = Array.from({ length: 1000 }, (_, i) => `id-1-${i}`);
      // Batch 2: returns 1000 IDs
      const batch2Ids = Array.from({ length: 1000 }, (_, i) => `id-2-${i}`);
      // Batch 3: returns 450 IDs (final batch)
      const batch3Ids = Array.from({ length: 450 }, (_, i) => `id-3-${i}`);

      mockPrisma.soilReading.findMany
        .mockResolvedValueOnce(batch1Ids.map((id) => ({ id })))
        .mockResolvedValueOnce(batch2Ids.map((id) => ({ id })))
        .mockResolvedValueOnce(batch3Ids.map((id) => ({ id })));

      mockPrisma.soilReading.deleteMany
        .mockResolvedValueOnce({ count: 1000 })
        .mockResolvedValueOnce({ count: 1000 })
        .mockResolvedValueOnce({ count: 450 });

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['soil_readings'],
        batchSize: 1000,
        yieldMs: 0,
        now: fixedNow,
      });

      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledTimes(3);
      expect(mockPrisma.soilReading.deleteMany).toHaveBeenCalledTimes(3);

      expect(summary.totalDeleted).toBe(2450);
      expect(summary.tables.soil_readings.deletedCount).toBe(2450);
      expect(summary.tables.soil_readings.batchesExecuted).toBe(3);

      // Verify other approved tables are 0
      expect(summary.tables.water_readings.deletedCount).toBe(0);
      expect(summary.tables.device_status_events.deletedCount).toBe(0);
    });

    it('handles empty table cleanly in 1 query without calling deleteMany', async () => {
      mockPrisma.soilReading.findMany.mockResolvedValueOnce([]);

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['soil_readings'],
        yieldMs: 0,
      });

      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.soilReading.deleteMany).not.toHaveBeenCalled();
      expect(summary.tables.soil_readings.deletedCount).toBe(0);
      expect(summary.tables.soil_readings.batchesExecuted).toBe(0);
    });

    it('prunes all approved tables when no table filter is specified', async () => {
      mockPrisma.soilReading.findMany.mockResolvedValueOnce([{ id: 's1' }]);
      mockPrisma.soilReading.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.waterReading.findMany.mockResolvedValueOnce([{ id: 'w1' }]);
      mockPrisma.waterReading.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.reservoirWaterReading.findMany.mockResolvedValueOnce([{ id: 'r1' }]);
      mockPrisma.reservoirWaterReading.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.sensorBatteryReading.findMany.mockResolvedValueOnce([{ id: 'b1' }]);
      mockPrisma.sensorBatteryReading.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.deviceStatusEvent.findMany.mockResolvedValueOnce([{ id: 'd1' }]);
      mockPrisma.deviceStatusEvent.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.integrationError.findMany.mockResolvedValueOnce([{ id: 'e1' }]);
      mockPrisma.integrationError.deleteMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.faucetCommand.findMany
        .mockResolvedValueOnce([{ id: 'fc1' }]) // batch ID query
        .mockResolvedValueOnce([
          {
            id: 'fc1',
            commandId: 'cmd-1',
            deviceId: 'dev-1',
            idempotencyKey: 'idem-1',
            status: 'COMPLETED',
            requestedAt: new Date('2026-06-01T00:00:00Z'),
          },
        ]); // full data query for tombstones
      mockPrisma.faucetCommand.deleteMany.mockResolvedValueOnce({ count: 1 });

      const summary = await retentionService.pruneExpiredTelemetry({ yieldMs: 0 });

      expect(summary.totalDeleted).toBe(7);
      expect(summary.tables.soil_readings.deletedCount).toBe(1);
      expect(summary.tables.water_readings.deletedCount).toBe(1);
      expect(summary.tables.reservoir_water_readings.deletedCount).toBe(1);
      expect(summary.tables.sensor_battery_readings.deletedCount).toBe(1);
      expect(summary.tables.device_status_events.deletedCount).toBe(1);
      expect(summary.tables.integration_errors.deletedCount).toBe(1);
      expect(summary.tables.faucet_commands.deletedCount).toBe(1);

      // Verify audit logs and account approvals are NEVER touched
      expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.accountApproval.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.accountApproval.deleteMany).not.toHaveBeenCalled();
    });

    it('prunes terminal faucet commands with 3-calendar-month UTC cutoff, creates tombstones, and preserves active commands', async () => {
      const fixedNow = new Date('2026-10-05T12:00:00.000Z');
      const expectedCutoff = new Date('2026-07-05T12:00:00.000Z');

      const expiredTerminalCmd = {
        id: 'cmd-expired-1',
        commandId: 'cmd-val-101',
        deviceId: 'dev-valve-1',
        idempotencyKey: 'idem-key-999',
        status: 'COMPLETED',
        requestedAt: new Date('2026-06-01T00:00:00Z'),
      };

      mockPrisma.faucetCommand.findMany
        .mockResolvedValueOnce([{ id: expiredTerminalCmd.id }])
        .mockResolvedValueOnce([expiredTerminalCmd]);
      mockPrisma.faucetCommand.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.faucetCommandEvent.deleteMany.mockResolvedValueOnce({ count: 2 });

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['faucet_commands'],
        now: fixedNow,
        yieldMs: 0,
      });

      // Verify query strictly checked for terminal statuses with 3-month cutoff
      expect(mockPrisma.faucetCommand.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: {
            in: ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'],
          },
        }),
        select: { id: true },
        take: 1000,
      });

      // Verify idempotency tombstone was recorded
      expect(mockPrisma.faucetCommandIdempotencyTombstone.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            idempotencyKey: 'idem-key-999',
            commandId: 'cmd-val-101',
            deviceId: 'dev-valve-1',
            originalStatus: 'COMPLETED',
          }),
        ],
        skipDuplicates: true,
      });

      // Verify dependent events were deleted
      expect(mockPrisma.faucetCommandEvent.deleteMany).toHaveBeenCalledWith({
        where: { faucetCommandId: { in: ['cmd-expired-1'] } },
      });

      // Verify terminal command was deleted
      expect(mockPrisma.faucetCommand.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['cmd-expired-1'] } },
      });

      expect(summary.totalDeleted).toBe(1);
      expect(summary.tables.faucet_commands.deletedCount).toBe(1);
    });

    it('prunes reservoir_water_readings using window function when $queryRaw is available (DEC-MON-092)', async () => {
      mockPrisma.$queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ id: 'excess-r1' }, { id: 'excess-r2' }]);
      mockPrisma.reservoirWaterReading.deleteMany.mockResolvedValueOnce({ count: 2 });

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['reservoir_water_readings'],
        yieldMs: 0,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reservoirWaterReading.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['excess-r1', 'excess-r2'] } },
      });
      expect(summary.tables.reservoir_water_readings.deletedCount).toBe(2);
    });

    it('enforces 3-calendar-month UTC cutoff for faucet_commands even when retentionDays is passed (e.g. 30 days)', async () => {
      const fixedNow = new Date('2026-10-05T12:00:00.000Z');
      const expected3MonthCutoff = new Date('2026-07-05T12:00:00.000Z');

      mockPrisma.faucetCommand.findMany.mockResolvedValueOnce([]);

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['faucet_commands'],
        retentionDays: 30,
        now: fixedNow,
        yieldMs: 0,
      });

      // Verify faucet_commands query used 3-month cutoff, NOT 30-day cutoff
      expect(mockPrisma.faucetCommand.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: {
            in: ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'],
          },
          OR: expect.arrayContaining([
            { completedAt: { not: null, lt: expected3MonthCutoff } },
            { failedAt: { not: null, lt: expected3MonthCutoff } },
            { cancelledAt: { not: null, lt: expected3MonthCutoff } },
            { status: { in: ['TIMEOUT', 'EXPIRED'] }, expiresAt: { lt: expected3MonthCutoff } },
            {
              completedAt: null,
              failedAt: null,
              cancelledAt: null,
              updatedAt: { lt: expected3MonthCutoff },
            },
          ]),
        }),
        select: { id: true },
        take: 1000,
      });

      expect(summary.cutoffDate).toEqual(expected3MonthCutoff);
      expect(summary.commandCutoffDate).toEqual(expected3MonthCutoff);
    });

    it('handles mixed-table cutoffs: telemetry uses retentionDays while faucet_commands strictly uses 3 calendar months', async () => {
      const fixedNow = new Date('2026-10-05T12:00:00.000Z');
      const expected30DayCutoff = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000);
      const expected3MonthCutoff = new Date('2026-07-05T12:00:00.000Z');

      mockPrisma.soilReading.findMany.mockResolvedValueOnce([]);
      mockPrisma.faucetCommand.findMany.mockResolvedValueOnce([]);

      const summary = await retentionService.pruneExpiredTelemetry({
        tables: ['soil_readings', 'faucet_commands'],
        retentionDays: 30,
        now: fixedNow,
        yieldMs: 0,
      });

      // Soil readings must use the 30-day cutoff
      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledWith({
        where: { receivedAt: { lt: expected30DayCutoff } },
        select: { id: true },
        take: 1000,
      });

      // Faucet commands must strictly use the 3-month cutoff despite retentionDays=30
      expect(mockPrisma.faucetCommand.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { completedAt: { not: null, lt: expected3MonthCutoff } },
          ]),
        }),
        select: { id: true },
        take: 1000,
      });

      expect(summary.commandCutoffDate).toEqual(expected3MonthCutoff);
    });

    it('rejects explicitly empty tables array with error and does not delete anything', async () => {
      await expect(
        retentionService.pruneExpiredTelemetry({
          tables: [],
        })
      ).rejects.toThrow('options.tables cannot be explicitly empty');

      expect(mockPrisma.soilReading.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommand.findMany).not.toHaveBeenCalled();
    });

    it('protects active commands: non-terminal statuses are never targeted for pruning', async () => {
      const fixedNow = new Date('2026-10-05T12:00:00.000Z');
      mockPrisma.faucetCommand.findMany.mockResolvedValueOnce([]);

      await retentionService.pruneExpiredTelemetry({
        tables: ['faucet_commands'],
        now: fixedNow,
        yieldMs: 0,
      });

      // Verify status array contains ONLY terminal statuses, strictly excluding QUEUED, SENT, ACKNOWLEDGED, IN_PROGRESS
      const callArgs = mockPrisma.faucetCommand.findMany.mock.calls[0][0];
      const targetedStatuses = callArgs.where.status.in;
      expect(targetedStatuses).toEqual(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED']);
      expect(targetedStatuses).not.toContain('QUEUED');
      expect(targetedStatuses).not.toContain('SENT');
      expect(targetedStatuses).not.toContain('ACKNOWLEDGED');
      expect(targetedStatuses).not.toContain('IN_PROGRESS');
    });
  });
});
