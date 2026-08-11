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
        findFirst: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      waterReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      sensorBatteryReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      reservoirWaterReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
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

  describe('ingestWaterReading (TASK-0406)', () => {
    it('successfully ingests valid water quality reading and updates lastSeenAt atomically (DEC-DEV-020, DEC-MON-086)', async () => {
      const mockDevice = {
        id: 'water-dev-uuid-1',
        deviceId: 'water-node-001',
        accountStatus: 'ACTIVE',
      };

      const mockCreatedWaterReading = {
        id: 'water-reading-uuid-1',
        deviceId: mockDevice.id,
        messageId: 'msg-water-001',
        sequenceNumber: BigInt(5),
        schemaVersion: '1.0',
        recordedAt: new Date('2026-08-10T10:00:00Z'),
        receivedAt: new Date('2026-08-10T10:00:01Z'),
        ph: new Prisma.Decimal(6.8),
        tds: new Prisma.Decimal(420),
        ec: new Prisma.Decimal(1.2),
        status: MonitoringStatus.NORMAL,
        validationStatus: TelemetryValidationStatus.VALID,
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.waterReading.create.mockResolvedValue(mockCreatedWaterReading);
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, lastSeenAt: new Date() });

      const input = {
        deviceId: 'water-node-001',
        messageId: 'msg-water-001',
        schemaVersion: '1.0',
        sequenceNumber: 5,
        recordedAt: '2026-08-10T10:00:00Z',
        ph: 6.8,
        tds: 420,
        ec: 1.2,
        status: MonitoringStatus.NORMAL,
      };

      const result = await repo.ingestWaterReading(input);

      expect(result.readingId).toBe(mockCreatedWaterReading.id);
      expect(result.deviceId).toBe(mockDevice.id);
      expect(result.canonicalDeviceId).toBe('water-node-001');
      expect(result.messageId).toBe('msg-water-001');
      expect(result.isDuplicate).toBe(false);

      // Verify waterReading create payload
      expect(mockPrisma.waterReading.create).toHaveBeenCalledTimes(1);
      const waterArg = mockPrisma.waterReading.create.mock.calls[0][0].data;
      expect(waterArg.deviceId).toBe(mockDevice.id);
      expect(waterArg.ph).toEqual(new Prisma.Decimal(6.8));

      // Verify atomic device update call
      expect(mockPrisma.device.update).toHaveBeenCalledTimes(1);
    });

    it('PRESERVES NUMERIC 0 values and NULL for omitted parameters', async () => {
      const mockDevice = {
        id: 'water-dev-uuid-1',
        deviceId: 'water-node-001',
        accountStatus: 'ACTIVE',
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.waterReading.create.mockResolvedValue({
        id: 'water-reading-uuid-2',
        deviceId: mockDevice.id,
        messageId: 'msg-water-zero',
        recordedAt: null,
        receivedAt: new Date(),
        ph: new Prisma.Decimal(0),
        tds: null,
        validationStatus: TelemetryValidationStatus.VALID,
      });

      const input = {
        deviceId: 'water-node-001',
        messageId: 'msg-water-zero',
        schemaVersion: '1.0',
        ph: 0, // Explicit zero
        // tds omitted
      };

      await repo.ingestWaterReading(input);

      const waterArg = mockPrisma.waterReading.create.mock.calls[0][0].data;
      expect(waterArg.ph).toEqual(new Prisma.Decimal(0));
      expect(waterArg.tds).toBeNull();
      expect(waterArg.ec).toBeNull();
    });

    it('handles DUPLICATE water message IDs idempotently without throwing error', async () => {
      const mockDevice = {
        id: 'water-dev-uuid-1',
        deviceId: 'water-node-001',
        accountStatus: 'ACTIVE',
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });

      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      const mockExistingReading = {
        id: 'existing-water-reading-id',
        deviceId: mockDevice.id,
        messageId: 'msg-water-dup',
        recordedAt: new Date('2026-08-10T10:00:00Z'),
        receivedAt: new Date('2026-08-10T10:00:01Z'),
        validationStatus: TelemetryValidationStatus.VALID,
      };

      mockPrisma.waterReading.findUnique.mockResolvedValue(mockExistingReading);

      const input = {
        deviceId: 'water-node-001',
        messageId: 'msg-water-dup',
        schemaVersion: '1.0',
      };

      const result = await repo.ingestWaterReading(input);

      expect(result.readingId).toBe('existing-water-reading-id');
      expect(result.isDuplicate).toBe(true);
      expect(result.messageId).toBe('msg-water-dup');
    });

    it('throws DeviceNotFoundError when target device does not exist', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      const input = {
        deviceId: 'unregistered-water-999',
        messageId: 'msg-water-001',
        schemaVersion: '1.0',
      };

      await expect(repo.ingestWaterReading(input)).rejects.toThrow(DeviceNotFoundError);
    });
  });

  describe('getLatestWaterTankReading', () => {
    it('queries using relation filter when non-UUID canonical deviceId is passed', async () => {
      mockPrisma.reservoirWaterReading.findFirst.mockResolvedValue({
        id: 'reading-tank-1',
        deviceId: '33333333-3333-3333-3333-333333333333',
        tankVolume: new Prisma.Decimal(1500),
        flowRate: new Prisma.Decimal(25.5),
        status: 'NORMAL',
      });

      const res = await repo.getLatestWaterTankReading('water-tank-node-3uufzi');

      expect(mockPrisma.reservoirWaterReading.findFirst).toHaveBeenCalledWith({
        where: { device: { deviceId: 'water-tank-node-3uufzi' } },
        orderBy: { receivedAt: 'desc' },
      });
      expect(res?.id).toBe('reading-tank-1');
    });
  });

  describe('Historical Query Methods (TASK-0503)', () => {
    const mockDevice = {
      id: 'dev-uuid-1',
      deviceId: 'DEV-SOIL-001',
    };

    describe('getSoilHistory', () => {
      it('returns raw soil history series preserving 0 vs null semantics and pagination meta', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
        mockPrisma.soilReading.count.mockResolvedValue(2);
        mockPrisma.soilReading.findMany.mockResolvedValue([
          {
            recordedAt: new Date('2026-08-01T10:00:00Z'),
            receivedAt: new Date('2026-08-01T10:00:01Z'),
            nitrogen: new Prisma.Decimal(0), // zero
            phosphorus: null, // null
            potassium: new Prisma.Decimal(50.5),
            temperature: new Prisma.Decimal(25.0),
            moisture: new Prisma.Decimal(60.0),
            ph: new Prisma.Decimal(6.5),
            ec: new Prisma.Decimal(1.1),
            status: 'NORMAL',
          },
        ]);

        const result = await repo.getSoilHistory({
          deviceIdentifier: 'DEV-SOIL-001',
          from: new Date('2026-08-01T00:00:00Z'),
          to: new Date('2026-08-02T00:00:00Z'),
          interval: 'raw',
          page: 1,
          pageSize: 50,
        });

        expect(result.deviceId).toBe('DEV-SOIL-001');
        expect(result.series.length).toBe(1);
        expect(result.series[0].nitrogen).toBe(0); // preserved zero
        expect(result.series[0].phosphorus).toBeNull(); // preserved null
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 50,
          totalRecords: 2,
          totalPages: 1,
        });
      });

      it('throws DeviceNotFoundError when device does not exist', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(null);

        await expect(
          repo.getSoilHistory({
            deviceIdentifier: 'NONEXISTENT',
            from: new Date(),
            to: new Date(),
          })
        ).rejects.toThrow(DeviceNotFoundError);
      });
    });

    describe('getWaterHistory', () => {
      it('returns water quality readings', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
        mockPrisma.waterReading.findMany.mockResolvedValue([
          {
            recordedAt: new Date('2026-08-01T10:00:00Z'),
            receivedAt: new Date('2026-08-01T10:00:01Z'),
            ph: new Prisma.Decimal(7.0),
            tds: new Prisma.Decimal(300),
            ec: new Prisma.Decimal(0.9),
            status: 'NORMAL',
          },
        ]);
        mockPrisma.waterReading.count.mockResolvedValue(1);

        const result = await repo.getWaterHistory({
          deviceIdentifier: 'DEV-WATER-001',
          from: new Date('2026-08-01T00:00:00Z'),
          to: new Date('2026-08-02T00:00:00Z'),
        });

        expect(result.series.length).toBe(1);
        expect(result.series[0].ph).toBe(7.0);
        expect((result.series[0] as any).tankVolume).toBeUndefined();
      });
    });
  });
});
