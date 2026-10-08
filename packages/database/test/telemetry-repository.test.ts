import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';
import { DeviceNotFoundError } from '../src/device-repository';
import {
  TelemetryValidationStatus,
  MonitoringStatus,
  DeviceConnectionStatus,
} from '@kebun-melon/contracts';

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
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
      $executeRaw: vi.fn().mockResolvedValue(0),
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
      expect(mockPrisma.device.update.mock.calls[0][0].data.connectionStatus).toBe(
        DeviceConnectionStatus.ONLINE
      );
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
      expect(mockPrisma.device.update.mock.calls[0][0].data.connectionStatus).toBe(
        DeviceConnectionStatus.ONLINE
      );
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

  describe('ingestReservoirReading', () => {
    it('successfully ingests valid reservoir reading and updates device connectionStatus to ONLINE', async () => {
      const mockDevice = {
        id: 'reservoir-dev-uuid-1',
        deviceId: 'water-tank-001',
        accountStatus: 'ACTIVE',
      };

      const mockCreatedReading = {
        id: 'reservoir-reading-uuid-1',
        deviceId: mockDevice.id,
        messageId: 'msg-res-001',
        sequenceNumber: BigInt(5),
        schemaVersion: '1.0',
        recordedAt: new Date('2026-08-01T08:00:00Z'),
        receivedAt: new Date('2026-08-01T08:00:01Z'),
        tankVolume: new Prisma.Decimal(9.79),
        status: MonitoringStatus.NORMAL,
        validationStatus: TelemetryValidationStatus.VALID,
      };

      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.reservoirWaterReading.create.mockResolvedValue(mockCreatedReading);
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, lastSeenAt: new Date() });

      const input = {
        deviceId: 'water-tank-001',
        messageId: 'msg-res-001',
        schemaVersion: '1.0',
        sequenceNumber: 5,
        recordedAt: '2026-08-01T08:00:00Z',
        tankVolume: 9.79,
        status: MonitoringStatus.NORMAL,
      };

      const result = await repo.ingestReservoirReading(input);

      expect(result.readingId).toBe(mockCreatedReading.id);
      expect(result.deviceId).toBe(mockDevice.id);
      expect(result.isDuplicate).toBe(false);

      expect(mockPrisma.reservoirWaterReading.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.device.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.device.update.mock.calls[0][0].where).toEqual({ id: mockDevice.id });
      expect(mockPrisma.device.update.mock.calls[0][0].data.connectionStatus).toBe(
        DeviceConnectionStatus.ONLINE
      );
    });

    it('retains all records and does not delete when fewer than 5 records exist', async () => {
      const mockDevice = {
        id: 'reservoir-dev-uuid-1',
        deviceId: 'water-tank-001',
        accountStatus: 'ACTIVE',
      };
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.reservoirWaterReading.create.mockResolvedValue({
        id: 'res-new',
        deviceId: mockDevice.id,
        receivedAt: new Date(),
        validationStatus: TelemetryValidationStatus.VALID,
      });
      // 3 existing records (< 5)
      mockPrisma.reservoirWaterReading.findMany.mockResolvedValueOnce([
        { id: 'res-new' },
        { id: 'res-2' },
        { id: 'res-1' },
      ]);

      await repo.ingestReservoirReading({
        deviceId: 'water-tank-001',
        messageId: 'msg-res-002',
        tankVolume: 12.5,
      });

      expect(mockPrisma.reservoirWaterReading.findMany).toHaveBeenCalledWith({
        where: { deviceId: mockDevice.id },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: { id: true },
      });
      // No deleteMany because length < 5
      expect(mockPrisma.reservoirWaterReading.deleteMany).not.toHaveBeenCalled();
    });

    it('atomically trims older excess records when 5 or more records exist, keeping latest 5', async () => {
      const mockDevice = {
        id: 'reservoir-dev-uuid-1',
        deviceId: 'water-tank-001',
        accountStatus: 'ACTIVE',
      };
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.reservoirWaterReading.create.mockResolvedValue({
        id: 'res-6',
        deviceId: mockDevice.id,
        receivedAt: new Date(),
        validationStatus: TelemetryValidationStatus.VALID,
      });
      // Top 5 records returned by findMany (descending order)
      const top5 = [
        { id: 'res-6' },
        { id: 'res-5' },
        { id: 'res-4' },
        { id: 'res-3' },
        { id: 'res-2' },
      ];
      mockPrisma.reservoirWaterReading.findMany.mockResolvedValueOnce(top5);

      await repo.ingestReservoirReading({
        deviceId: 'water-tank-001',
        messageId: 'msg-res-006',
        tankVolume: 15.0,
      });

      expect(mockPrisma.reservoirWaterReading.deleteMany).toHaveBeenCalledWith({
        where: {
          deviceId: mockDevice.id,
          id: { notIn: ['res-6', 'res-5', 'res-4', 'res-3', 'res-2'] },
        },
      });
    });

    it('enforces device isolation: only trims records for the specific ingested device', async () => {
      const mockDeviceA = {
        id: 'device-uuid-a',
        deviceId: 'water-tank-a',
        accountStatus: 'ACTIVE',
      };
      mockPrisma.device.findFirst.mockResolvedValue(mockDeviceA);
      mockPrisma.reservoirWaterReading.create.mockResolvedValue({
        id: 'res-a-new',
        deviceId: mockDeviceA.id,
        receivedAt: new Date(),
        validationStatus: TelemetryValidationStatus.VALID,
      });
      mockPrisma.reservoirWaterReading.findMany.mockResolvedValueOnce([
        { id: 'res-a-5' },
        { id: 'res-a-4' },
        { id: 'res-a-3' },
        { id: 'res-a-2' },
        { id: 'res-a-1' },
      ]);

      await repo.ingestReservoirReading({
        deviceId: 'water-tank-a',
        messageId: 'msg-a',
        tankVolume: 20.0,
      });

      // Verify the delete filter strictly scopes to device-uuid-a
      expect(mockPrisma.reservoirWaterReading.deleteMany).toHaveBeenCalledWith({
        where: {
          deviceId: 'device-uuid-a',
          id: { notIn: ['res-a-5', 'res-a-4', 'res-a-3', 'res-a-2', 'res-a-1'] },
        },
      });
    });
  });

  describe('getLatestWaterTankReading', () => {
    it('queries using relation filter when non-UUID canonical deviceId is passed with stable tie-breaker', async () => {
      mockPrisma.reservoirWaterReading.findFirst.mockResolvedValue({
        id: 'reading-tank-1',
        deviceId: '33333333-3333-3333-3333-333333333333',
        tankVolume: new Prisma.Decimal(1500),
        status: 'NORMAL',
      });

      const res = await repo.getLatestWaterTankReading('water-tank-node-3uufzi');

      expect(mockPrisma.reservoirWaterReading.findFirst).toHaveBeenCalledWith({
        where: {
          device: {
            OR: [
              { deviceId: 'water-tank-node-3uufzi' },
              { deviceId: { equals: 'water-tank-node-3uufzi', mode: 'insensitive' } },
            ],
          },
        },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      });
      expect(res?.id).toBe('reading-tank-1');
    });
  });

  describe('pruneExcessReservoirReadings (DEC-MON-092 / TASK-0917)', () => {
    it('executes window-function raw deletion when $executeRaw is available', async () => {
      mockPrisma.$executeRaw.mockResolvedValueOnce(12);

      const count = await repo.pruneExcessReservoirReadings(5);

      expect(count).toBe(12);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
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

  // TASK-0503 / TASK-0504: portable soil & water-quality reading history with
  // location annotations. These tests lock the approved behaviour so a later
  // refactor cannot silently reintroduce hourly aggregation, drop unnamed
  // readings, blend two physical locations, or lose the annotation actor.
  describe('Reading location & pagination contracts (TASK-0503/TASK-0504)', () => {
    let mockPrisma: any;
    let repo: TelemetryRepository;

    const readingId = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const otherReadingId = '4f2504e0-4f89-11d3-9a0c-0305e82c3302';
    // Declared locally: the location contract tests must not depend on the
    // device fixture owned by the TASK-0405 suite above.
    const mockDevice = {
      id: '11111111-2222-4333-8444-555555555555',
      deviceId: 'DEV-SOIL-001',
      name: 'Soil Sensor',
      deviceType: 'SOIL',
    } as any;

    beforeEach(() => {
      mockPrisma = {
        device: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        soilReading: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          count: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
        waterReading: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          count: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
        $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
        $executeRaw: vi.fn().mockResolvedValue(0),
      };

      repo = new TelemetryRepository(mockPrisma as any);
    });

    /** Minimal chart row: only the fields the chart query maps are set. */
    const chartRow = (n: number, iso: string) => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      recordedAt: new Date(iso),
      receivedAt: new Date(iso),
      nitrogen: new Prisma.Decimal(1),
      phosphorus: new Prisma.Decimal(1),
      potassium: new Prisma.Decimal(1),
      temperature: new Prisma.Decimal(25),
      moisture: new Prisma.Decimal(60),
      ph: new Prisma.Decimal(6.5),
      ec: new Prisma.Decimal(1),
    });

    it('defaults history pagination to exactly five readings per page', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.count.mockResolvedValue(12);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      await repo.getSoilHistory({
        deviceIdentifier: 'DEV-SOIL-001',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      });

      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 0 })
      );
    });

    it('computes pagination metadata from the total record count', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.count.mockResolvedValue(12);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      const result = await repo.getSoilHistory({
        deviceIdentifier: 'DEV-SOIL-001',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        page: 3,
      });

      expect(result.pagination).toEqual({
        page: 3,
        pageSize: 5,
        totalRecords: 12,
        totalPages: 3,
      });
      // Page 3 of a 12-record set must skip past the two earlier pages.
      expect(mockPrisma.soilReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 })
      );
    });

    it('orders chronologically by receivedAt with a deterministic id tiebreaker', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.count.mockResolvedValue(1);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      await repo.getSoilHistory({
        deviceIdentifier: 'DEV-SOIL-001',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      });

      // Rows are appended over time and ordered oldest-first by `receivedAt`
      // with an `id` tiebreaker. A reading arriving while a user is on an older
      // page therefore lands after those rows instead of shifting them.
      const [args] = mockPrisma.soilReading.findMany.mock.calls[0];
      expect(args.orderBy).toEqual([{ receivedAt: 'asc' }, { id: 'asc' }]);
    });

    it('keeps unnamed readings in the history table', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.count.mockResolvedValue(7);
      mockPrisma.soilReading.findMany.mockResolvedValue([
        {
          id: readingId,
          recordedAt: new Date('2026-10-01T05:00:00Z'),
          receivedAt: new Date('2026-10-01T05:00:02Z'),
          nitrogen: new Prisma.Decimal(0),
          phosphorus: null,
          potassium: new Prisma.Decimal(50.5),
          temperature: new Prisma.Decimal(25),
          moisture: new Prisma.Decimal(60),
          ph: new Prisma.Decimal(6.5),
          ec: new Prisma.Decimal(1.1),
          status: 'NORMAL',
          locationName: null,
          locationKey: null,
          locationAnnotatedAt: null,
          namedByUser: null,
        },
      ]);

      const result = await repo.getSoilHistory({
        deviceIdentifier: 'DEV-SOIL-001',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      });

      // Unnamed readings stay reachable: the table lists every retained
      // reading, it is only the chart that requires a location.
      expect(result.series.length).toBe(1);
      expect(result.series[0].locationName).toBeNull();
      // 0 must survive as 0 and a missing value must stay null, never zero.
      expect(result.series[0].nitrogen).toBe(0);
      expect(result.series[0].phosphorus).toBeNull();
      expect(result.pagination.totalRecords).toBe(7);
    });

    it('excludes readings without a location from the chart series', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: 'Bed A1',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        limit: 800,
      });

      const [args] = mockPrisma.soilReading.findMany.mock.calls[0];
      expect(args.where.locationKey).toBe('bed a1');
    });

    it('normalises the chart location filter so casing or padding cannot split one place', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: '  bed a1  ',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      });

      const [args] = mockPrisma.soilReading.findMany.mock.calls[0];
      expect(args.where.locationKey).toBe('bed a1');
    });

    it('queries the chart over the selected window rather than a single table page', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findMany.mockResolvedValue([]);

      await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: 'Bed A1',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        limit: 800,
      });

      const [args] = mockPrisma.soilReading.findMany.mock.calls[0];
      // The chart is independent of table pagination: it selects by date and
      // by location, never by the page slice the table happens to show.
      expect(args.where).toEqual({
        deviceId: mockDevice.id,
        locationKey: 'bed a1',
        receivedAt: {
          gte: new Date('2026-10-01T00:00:00Z'),
          lte: new Date('2026-10-02T00:00:00Z'),
        },
      });
      // Ascending keyset ordering [receivedAt, id] for deterministic batched retrieval
      expect(args.orderBy).toEqual([{ receivedAt: 'asc' }, { id: 'asc' }]);
      expect(args.take).toBe(800);
    });

    it('returns pagination cursor when result reaches limit', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      // Three matching rows for a limit of two. Keyset cursor pagination uses
      // `nextCursor` to allow continuous bounded batched retrieval.
      mockPrisma.soilReading.count.mockResolvedValue(3);
      mockPrisma.soilReading.findMany.mockResolvedValue([
        { ...chartRow(1, '2026-10-01T05:00:00Z'), locationName: 'Bed A1', locationKey: 'bed a1' },
        { ...chartRow(2, '2026-10-01T05:00:01Z'), locationName: 'Bed A1', locationKey: 'bed a1' },
      ]);

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: 'Bed A1',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        limit: 2,
      });

      expect(result.nextCursor).toBe(
        '2026-10-01T05:00:01.000Z_00000000-0000-4000-8000-000000000002'
      );
      expect(result.truncated).toBe(false);
      // Readings stay in chronological order.
      expect(result.series.length).toBe(2);
      expect(result.series[0].timestamp).toBe('2026-10-01T05:00:00.000Z');
      expect(result.series[1].timestamp).toBe('2026-10-01T05:00:01.000Z');
    });

    it('returns null nextCursor when the row count is below limit', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.count.mockResolvedValue(1);
      mockPrisma.soilReading.findMany.mockResolvedValue([
        { ...chartRow(1, '2026-10-01T05:00:00Z'), locationName: 'Bed A1', locationKey: 'bed a1' },
      ]);

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: 'Bed A1',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        limit: 2,
      });

      expect(result.nextCursor).toBeNull();
      expect(result.truncated).toBe(false);
      expect(result.series.length).toBe(1);
      expect(result.series[0].timestamp).toBe('2026-10-01T05:00:00.000Z');
    });

    it('keeps every stored reading without hourly aggregation or downsampling', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      // The repository queries newest-first (with an `id` tie-break) and then
      // reverses for display, so the mock returns rows in that shape. Both
      // readings share a `receivedAt`, which is exactly the case the tie-break
      // has to make deterministic.
      mockPrisma.soilReading.count.mockResolvedValue(2);
      mockPrisma.soilReading.findMany.mockResolvedValue([
        {
          id: otherReadingId,
          recordedAt: new Date('2026-10-01T05:00:01Z'),
          receivedAt: new Date('2026-10-01T05:00:02Z'),
          nitrogen: new Prisma.Decimal(12),
          phosphorus: new Prisma.Decimal(4),
          potassium: new Prisma.Decimal(51),
          temperature: new Prisma.Decimal(26),
          moisture: new Prisma.Decimal(58),
          ph: new Prisma.Decimal(6.6),
          ec: new Prisma.Decimal(1.2),
          status: 'NORMAL',
          locationName: 'Bed A1',
          locationKey: 'bed a1',
          locationAnnotatedAt: new Date('2026-10-01T06:00:00Z'),
          namedByUser: null,
        },
        {
          id: readingId,
          recordedAt: new Date('2026-10-01T05:00:00Z'),
          receivedAt: new Date('2026-10-01T05:00:02Z'),
          nitrogen: new Prisma.Decimal(0),
          phosphorus: null,
          potassium: new Prisma.Decimal(50.5),
          temperature: new Prisma.Decimal(25),
          moisture: new Prisma.Decimal(60),
          ph: new Prisma.Decimal(6.5),
          ec: new Prisma.Decimal(1.1),
          status: 'NORMAL',
          locationName: 'Bed A1',
          locationKey: 'bed a1',
          locationAnnotatedAt: new Date('2026-10-01T06:00:00Z'),
          namedByUser: null,
        },
      ]);

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'DEV-SOIL-001',
        locationKey: 'Bed A1',
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
        limit: 800,
      });

      // Two readings one second apart are both returned at their own
      // timestamps; nothing is merged into an hourly bucket or interpolated.
      expect(result.series.length).toBe(2);
      expect(result.series[0].timestamp).toBe('2026-10-01T05:00:00.000Z');
      expect(result.series[1].timestamp).toBe('2026-10-01T05:00:01.000Z');
      expect(result.series[0].nitrogen).toBe(0);
      expect(result.series[1].phosphorus).toBe(4);
      // A metric with no stored value stays null instead of collapsing to 0.
      expect(result.series[0].phosphorus).toBeNull();
    });

    it('binds an annotation to one immutable reading id, not the device location', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findFirst.mockResolvedValue({
        id: readingId,
        deviceId: 'DEV-SOIL-001',
        locationName: null,
        locationKey: null,
        locationAnnotatedAt: null,
      });
      mockPrisma.soilReading.update.mockResolvedValue({
        id: readingId,
        deviceId: 'DEV-SOIL-001',
        locationName: 'Bed A1',
        locationKey: 'bed a1',
        locationAnnotatedAt: new Date('2026-10-01T06:00:00Z'),
        locationNamedById: 'operator-1',
      });

      const result = await repo.setSoilReadingLocation({
        deviceIdentifier: 'DEV-SOIL-001',
        readingId,
        locationName: 'Bed A1',
        namedByUserId: 'operator-1',
      });

      expect(mockPrisma.soilReading.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: readingId }),
          data: expect.objectContaining({
            locationName: 'Bed A1',
            locationKey: 'bed a1',
            locationNamedById: 'operator-1',
          }),
        })
      );
      // The device row itself is never rewritten: a portable device must not
      // accumulate a single "current" place that later readings would inherit.
      expect(mockPrisma.device.update).not.toHaveBeenCalled();
      expect(result.readingId).toBe(readingId);
    });

    it('records an audit entry whenever a location is saved or cleared', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findFirst.mockResolvedValue({
        id: readingId,
        deviceId: 'DEV-SOIL-001',
        locationName: 'Bed A1',
        locationKey: 'bed a1',
        locationAnnotatedAt: new Date('2026-10-01T06:00:00Z'),
      });
      mockPrisma.soilReading.update.mockResolvedValue({
        id: readingId,
        deviceId: 'DEV-SOIL-001',
        locationName: null,
        locationKey: null,
        locationAnnotatedAt: null,
        locationNamedById: null,
      });

      const result = await repo.setSoilReadingLocation({
        deviceIdentifier: 'DEV-SOIL-001',
        readingId,
        locationName: null,
        namedByUserId: 'operator-2',
      });

      // Clearing preserves the previous name in the return value so the route
      // can write it to the audit log instead of losing it with the columns.
      expect(result.applied).toBe(true);
      expect(result.previousLocationName).toBe('Bed A1');
      expect(mockPrisma.soilReading.update).toHaveBeenCalledWith({
        where: { id: readingId },
        data: {
          locationName: null,
          locationKey: null,
          locationAnnotatedAt: null,
          locationNamedById: null,
        },
      });
    });

    it('normalises a whitespace or casing variant to the same location identity', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findFirst.mockResolvedValue({
        id: readingId,
        deviceId: mockDevice.id,
        locationName: null,
        locationKey: null,
        locationAnnotatedAt: null,
      });
      mockPrisma.soilReading.update.mockResolvedValue({
        id: readingId,
        deviceId: 'DEV-SOIL-001',
        locationName: 'Bed A1',
        locationKey: 'bed a1',
        locationAnnotatedAt: new Date('2026-10-01T06:00:00Z'),
        locationNamedById: 'operator-1',
      });

      await repo.setSoilReadingLocation({
        deviceIdentifier: 'DEV-SOIL-001',
        readingId,
        locationName: '  Bed   A1  ',
        namedByUserId: 'operator-1',
      });

      // Whitespace inside the name is collapsed for the display form and the
      // identity key is lowercased, so the same physical place cannot fragment
      // into several location identities that would split the chart series.
      expect(mockPrisma.soilReading.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationName: 'Bed A1',
            locationKey: 'bed a1',
          }),
        })
      );
    });

    it('refuses an annotation that targets a reading not owned by the device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.soilReading.findFirst.mockResolvedValue(null);

      const result = await repo.setSoilReadingLocation({
        deviceIdentifier: 'DEV-SOIL-001',
        readingId,
        locationName: 'Bed A1',
        namedByUserId: 'operator-1',
      });

      // Nothing is written when the reading is not part of this device, so an
      // annotation can never leak across devices.
      expect(result.applied).toBe(false);
      expect(mockPrisma.soilReading.update).not.toHaveBeenCalled();
    });
  });
});
