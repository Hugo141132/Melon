import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';
import { DeviceNotFoundError } from '../src/device-repository';
import { TelemetryValidationStatus, MonitoringStatus } from '@kebun-melon/contracts';

describe('TelemetryRepository Unit Tests (TASK-0405)', () => {
  let mockPrisma: any;
  let repo: TelemetryRepository;

  beforeEach(() => {
    mockPrisma = {
      device: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      soilReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    };

    repo = new TelemetryRepository(mockPrisma as any);
  });

  describe('ingestSoilReading', () => {
    it('successfully ingests valid soil reading, preserving 0 numeric values and updating lastSeenAt atomically', async () => {
      const mockDevice = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'soil-node-001',
        accountStatus: 'ACTIVE',
      };

      const mockCreatedReading = {
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: mockDevice.id,
        messageId: 'msg-soil-001',
        sequenceNumber: BigInt(10),
        schemaVersion: '1.0',
        recordedAt: new Date('2026-08-01T08:00:00Z'),
        receivedAt: new Date('2026-08-01T08:00:01Z'),
        nitrogen: new Prisma.Decimal(0), // PRESERVED 0
        phosphorus: new Prisma.Decimal(21.5),
        potassium: new Prisma.Decimal(0), // PRESERVED 0
        temperature: new Prisma.Decimal(28.4),
        moisture: new Prisma.Decimal(65.0),
        ph: new Prisma.Decimal(6.5),
        ec: new Prisma.Decimal(1.2),
        status: MonitoringStatus.NORMAL,
        validationStatus: TelemetryValidationStatus.VALID,
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.create.mockResolvedValue(mockCreatedReading);
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, lastSeenAt: new Date() });

      const input = {
        deviceId: 'soil-node-001',
        messageId: 'msg-soil-001',
        schemaVersion: '1.0',
        sequenceNumber: 10,
        recordedAt: '2026-08-01T08:00:00Z',
        nitrogen: 0, // Explicit zero
        phosphorus: 21.5,
        potassium: 0, // Explicit zero
        temperature: 28.4,
        moisture: 65.0,
        ph: 6.5,
        ec: 1.2,
        status: MonitoringStatus.NORMAL,
      };

      const result = await repo.ingestSoilReading(input);

      expect(result.readingId).toBe(mockCreatedReading.id);
      expect(result.deviceId).toBe(mockDevice.id);
      expect(result.canonicalDeviceId).toBe('soil-node-001');
      expect(result.messageId).toBe('msg-soil-001');
      expect(result.isDuplicate).toBe(false);

      // Verify Prisma create payload
      expect(mockPrisma.soilReading.create).toHaveBeenCalledTimes(1);
      const createArg = mockPrisma.soilReading.create.mock.calls[0][0].data;
      expect(createArg.deviceId).toBe(mockDevice.id);
      expect(createArg.messageId).toBe('msg-soil-001');
      expect(createArg.nitrogen).toEqual(new Prisma.Decimal(0));
      expect(createArg.potassium).toEqual(new Prisma.Decimal(0));

      // Verify atomic device update call
      expect(mockPrisma.device.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.device.update.mock.calls[0][0].where).toEqual({ id: mockDevice.id });
    });

    it('PRESERVES NULL values for missing/null numeric parameters', async () => {
      const mockDevice = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'soil-node-001',
        accountStatus: 'ACTIVE',
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.create.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: mockDevice.id,
        messageId: 'msg-soil-null',
        recordedAt: null,
        receivedAt: new Date(),
        nitrogen: null,
        phosphorus: null,
        validationStatus: TelemetryValidationStatus.VALID,
      });

      const input = {
        deviceId: 'soil-node-001',
        messageId: 'msg-soil-null',
        schemaVersion: '1.0',
        nitrogen: null,
        // phosphorus omitted
      };

      await repo.ingestSoilReading(input);

      const createArg = mockPrisma.soilReading.create.mock.calls[0][0].data;
      expect(createArg.nitrogen).toBeNull();
      expect(createArg.phosphorus).toBeNull();
      expect(createArg.potassium).toBeNull();
    });

    it('handles DUPLICATE message IDs idempotently without throwing error', async () => {
      const mockDevice = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'soil-node-001',
        accountStatus: 'ACTIVE',
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);

      // Simulate Prisma P2002 Unique Constraint Error
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });

      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      const mockExistingReading = {
        id: 'existing-reading-id',
        deviceId: mockDevice.id,
        messageId: 'msg-soil-dup',
        recordedAt: new Date('2026-08-01T08:00:00Z'),
        receivedAt: new Date('2026-08-01T08:00:01Z'),
        validationStatus: TelemetryValidationStatus.VALID,
      };

      mockPrisma.soilReading.findUnique.mockResolvedValue(mockExistingReading);

      const input = {
        deviceId: 'soil-node-001',
        messageId: 'msg-soil-dup',
        schemaVersion: '1.0',
      };

      const result = await repo.ingestSoilReading(input);

      expect(result.readingId).toBe('existing-reading-id');
      expect(result.isDuplicate).toBe(true);
      expect(result.messageId).toBe('msg-soil-dup');
    });

    it('throws DeviceNotFoundError when target device does not exist', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      const input = {
        deviceId: 'unregistered-node-999',
        messageId: 'msg-soil-001',
        schemaVersion: '1.0',
      };

      await expect(repo.ingestSoilReading(input)).rejects.toThrow(DeviceNotFoundError);
    });
  });
});
