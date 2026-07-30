import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DeviceRepository,
  DeviceConflictError,
  DeviceNotFoundError,
} from '../src/device-repository';
import { DeviceType, DeviceAccountStatus, DeviceConnectionStatus } from '@kebun-melon/contracts';

describe('DeviceRepository Unit Tests (TASK-0302)', () => {
  let mockPrisma: any;
  let repo: DeviceRepository;

  beforeEach(() => {
    mockPrisma = {
      device: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    };

    repo = new DeviceRepository(mockPrisma as any);
  });

  describe('getDevices', () => {
    it('queries devices and formats public safe DTO without secret exposure', async () => {
      const mockRawDevices = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          deviceId: 'water-node-001',
          siteId: null,
          name: 'Water Node 1',
          deviceType: 'WATER_NODE',
          accountStatus: 'ACTIVE',
          connectionStatus: 'ONLINE',
          firmwareVersion: '1.0.0',
          hardwareRevision: null,
          schemaVersion: '1.0',
          lastSeenAt: new Date('2026-07-30T10:00:00Z'),
          lastMessageAt: new Date('2026-07-30T10:00:00Z'),
          latitude: -6.2001,
          longitude: 106.8168,
          createdAt: new Date('2026-07-30T09:00:00Z'),
          updatedAt: new Date('2026-07-30T09:00:00Z'),
          deactivatedAt: null,
          capabilities: [{ capability: 'WATER_TELEMETRY', enabled: true }],
        },
      ];

      mockPrisma.device.count.mockResolvedValue(1);
      mockPrisma.device.findMany.mockResolvedValue(mockRawDevices);

      const result = await repo.getDevices({ page: 1, pageSize: 10, sort: 'createdAt:desc' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].deviceId).toBe('water-node-001');
      expect(result.items[0].latitude).toBe(-6.2001);
      expect(result.items[0].capabilities).toEqual(['WATER_TELEMETRY']);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('filters by authorizedDeviceIds when supplied for ADMIN user scoping', async () => {
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.device.findMany.mockResolvedValue([]);

      const authorizedIds = ['11111111-1111-1111-1111-111111111111'];
      await repo.getDevices({ page: 1, pageSize: 10, sort: 'createdAt:desc' }, authorizedIds);

      expect(mockPrisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: authorizedIds },
          }),
        })
      );
    });
  });

  describe('createDevice', () => {
    it('creates device, derives profile capabilities server-side, and records audit event', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      const createdRaw = {
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'soil-node-001',
        name: 'Soil Node 1',
        deviceType: 'SOIL_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'UNKNOWN',
        firmwareVersion: '1.0.0',
        hardwareRevision: null,
        schemaVersion: '1.0',
        lastSeenAt: null,
        lastMessageAt: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deactivatedAt: null,
        capabilities: [
          { capability: 'SOIL_NITROGEN', enabled: true },
          { capability: 'SOIL_PHOSPHORUS', enabled: true },
          { capability: 'SOIL_POTASSIUM', enabled: true },
          { capability: 'SOIL_TEMPERATURE', enabled: true },
          { capability: 'SOIL_MOISTURE', enabled: true },
          { capability: 'SOIL_PH', enabled: true },
          { capability: 'SOIL_EC', enabled: true },
        ],
      };

      mockPrisma.device.create.mockResolvedValue(createdRaw);

      const result = await repo.createDevice(
        {
          deviceId: 'soil-node-001',
          name: 'Soil Node 1',
          deviceType: DeviceType.SOIL_NODE as any,
        },
        'owner-user-id'
      );

      expect(result.deviceId).toBe('soil-node-001');
      expect(result.capabilities).toContain('SOIL_NITROGEN');
      expect(result.capabilities).toContain('SOIL_EC');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'device.created',
            actorUserId: 'owner-user-id',
          }),
        })
      );
    });

    it('rejects duplicate canonical deviceId with DeviceConflictError', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'existing-id',
        deviceId: 'soil-node-001',
      });

      await expect(
        repo.createDevice(
          {
            deviceId: 'soil-node-001',
            name: 'Soil Node 1',
            deviceType: DeviceType.SOIL_NODE,
          },
          'owner-user-id'
        )
      ).rejects.toThrow(DeviceConflictError);
    });
  });

  describe('deactivateDevice', () => {
    it('sets accountStatus = DEACTIVATED and connectionStatus = INACTIVE', async () => {
      const existing = {
        id: '33333333-3333-3333-3333-333333333333',
        deviceId: 'water-node-002',
        name: 'Water Node 2',
        deviceType: 'WATER_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: [],
      };

      mockPrisma.device.findFirst.mockResolvedValue(existing);

      const deactivatedRaw = {
        ...existing,
        accountStatus: 'DEACTIVATED',
        connectionStatus: 'INACTIVE',
        deactivatedAt: new Date(),
      };

      mockPrisma.device.update.mockResolvedValue(deactivatedRaw);

      const result = await repo.deactivateDevice('water-node-002', 'owner-id');

      expect(result.accountStatus).toBe(DeviceAccountStatus.DEACTIVATED);
      expect(result.connectionStatus).toBe(DeviceConnectionStatus.INACTIVE);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'device.deactivated',
          }),
        })
      );
    });

    it('throws DeviceNotFoundError if target device does not exist', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      await expect(repo.deactivateDevice('unknown-id', 'owner-id')).rejects.toThrow(
        DeviceNotFoundError
      );
    });
  });

  describe('deleteDevicePermanently', () => {
    it('transactionally deletes all dependent records and device row with audit', async () => {
      const existing = {
        id: '44444444-4444-4444-4444-444444444444',
        deviceId: 'soil-node-003',
        name: 'Soil Node 3',
        deviceType: 'SOIL_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: [],
      };

      mockPrisma.device.findFirst.mockResolvedValue(existing);
      mockPrisma.deviceCapability = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
      mockPrisma.userDeviceAccess = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
      mockPrisma.deviceStatusEvent = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.soilReading = { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) };
      mockPrisma.waterReading = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.reservoirWaterReading = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.sensorBatteryReading = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.faucetCommand = {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.faucetCommandEvent = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.alert = {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.alertAcknowledgement = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.userPreference = { updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
      mockPrisma.device.delete = vi.fn().mockResolvedValue(existing);

      const result = await repo.deleteDevicePermanently('soil-node-003', 'owner-id');

      expect(result.deviceId).toBe('soil-node-003');
      expect(mockPrisma.device.delete).toHaveBeenCalledWith({
        where: { id: existing.id },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'device.deleted',
            actorUserId: 'owner-id',
          }),
        })
      );
    });

    it('throws DeviceNotFoundError if target device does not exist', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      await expect(repo.deleteDevicePermanently('unknown-id', 'owner-id')).rejects.toThrow(
        DeviceNotFoundError
      );
    });
  });
});
