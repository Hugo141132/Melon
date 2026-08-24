import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetentionService,
  APPROVED_RETENTION_TABLES,
  PROTECTED_EXEMPT_TABLES,
  UnapprovedRetentionTableError,
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
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      faucetCommandEvent: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      accountApproval: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    retentionService = new RetentionService(mockPrisma);
  });

  describe('Table Whitelisting and Safety', () => {
    it('defines exactly approved telemetry tables', () => {
      expect(APPROVED_RETENTION_TABLES).toEqual([
        'soil_readings',
        'water_readings',
        'reservoir_water_readings',
        'sensor_battery_readings',
        'device_status_events',
        'integration_errors',
      ]);
    });

    it('identifies critical audit and safety tables as protected/exempt', () => {
      expect(PROTECTED_EXEMPT_TABLES).toContain('audit_logs');
      expect(PROTECTED_EXEMPT_TABLES).toContain('faucet_commands');
      expect(PROTECTED_EXEMPT_TABLES).toContain('faucet_command_events');
      expect(PROTECTED_EXEMPT_TABLES).toContain('account_approvals');
    });

    it('rejects attempt to prune unapproved or protected table with UnapprovedRetentionTableError', async () => {
      await expect(
        retentionService.pruneExpiredTelemetry({
          tables: ['audit_logs' as any],
        })
      ).rejects.toThrow(UnapprovedRetentionTableError);

      await expect(
        retentionService.pruneExpiredTelemetry({
          tables: ['faucet_commands' as any],
        })
      ).rejects.toThrow(UnapprovedRetentionTableError);

      // Verify no database methods called on auditLog or faucetCommand
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommand.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Cutoff Date Calculation', () => {
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

      const summary = await retentionService.pruneExpiredTelemetry({ yieldMs: 0 });

      expect(summary.totalDeleted).toBe(6);
      expect(summary.tables.soil_readings.deletedCount).toBe(1);
      expect(summary.tables.water_readings.deletedCount).toBe(1);
      expect(summary.tables.reservoir_water_readings.deletedCount).toBe(1);
      expect(summary.tables.sensor_battery_readings.deletedCount).toBe(1);
      expect(summary.tables.device_status_events.deletedCount).toBe(1);
      expect(summary.tables.integration_errors.deletedCount).toBe(1);

      // Verify audit logs and faucet commands are NEVER touched
      expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommand.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommand.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommandEvent.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.faucetCommandEvent.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.accountApproval.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.accountApproval.deleteMany).not.toHaveBeenCalled();
    });
  });
});
