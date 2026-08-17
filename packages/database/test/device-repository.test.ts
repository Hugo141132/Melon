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
          deviceType: 'WATER_QUALITY_NODE',
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

  describe('updateDevice (TASK-0302 / DEC-DEV-028)', () => {
    it('updates canonical deviceId and name, preserving immutable database UUID id and logging audit', async () => {
      const existingDevice = {
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
        deviceType: 'WATER_QUALITY_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
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
        capabilities: [{ capability: 'WATER_PH', enabled: true }],
      };

      mockPrisma.device.findFirst
        .mockResolvedValueOnce(existingDevice) // getDeviceByCanonicalId initial lookup
        .mockResolvedValueOnce(null) // conflict check findFirst (no other device has this deviceId)
        .mockResolvedValueOnce({
          ...existingDevice,
          deviceId: 'water-node-001-renamed',
          name: 'Renamed Water Node',
        }); // format return lookup

      mockPrisma.device.update.mockResolvedValue({
        ...existingDevice,
        deviceId: 'water-node-001-renamed',
        name: 'Renamed Water Node',
      });

      const result = await repo.updateDevice(
        'water-node-001',
        {
          deviceId: 'water-node-001-renamed',
          name: 'Renamed Water Node',
        },
        'owner-user-id'
      );

      expect(result.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(result.deviceId).toBe('water-node-001-renamed');
      expect(result.name).toBe('Renamed Water Node');
      expect(mockPrisma.device.update).toHaveBeenCalledWith({
        where: { id: '22222222-2222-2222-2222-222222222222' },
        data: expect.objectContaining({
          deviceId: 'water-node-001-renamed',
          name: 'Renamed Water Node',
        }),
        include: { capabilities: true },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'device.updated',
            actorUserId: 'owner-user-id',
            targetId: '22222222-2222-2222-2222-222222222222',
            previousValues: expect.objectContaining({
              deviceId: 'water-node-001',
              name: 'Water Node 1',
            }),
            newValues: expect.objectContaining({
              deviceId: 'water-node-001-renamed',
              name: 'Renamed Water Node',
            }),
          }),
        })
      );
    });

    it('rejects duplicate canonical deviceId with DeviceConflictError', async () => {
      const existingDevice = {
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
        deviceType: 'WATER_QUALITY_NODE',
        accountStatus: 'ACTIVE',
        capabilities: [],
      };

      mockPrisma.device.findFirst
        .mockResolvedValueOnce(existingDevice) // getDeviceByCanonicalId lookup
        .mockResolvedValueOnce({
          id: 'another-device-id-999',
          deviceId: 'soil-node-001',
        }); // conflict check findFirst finds another device!

      await expect(
        repo.updateDevice(
          'water-node-001',
          {
            deviceId: 'soil-node-001',
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
        deviceType: 'WATER_QUALITY_NODE',
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

  describe('reconcileDeviceCapabilities & updateDevice', () => {
    it('reconciles WATER_TANK_NODE to exactly WATER_TANK_VOLUME, WATER_FLOW_RATE, and FAUCET_CONTROL', async () => {
      const mockDevice = {
        id: 'tank-device-id',
        deviceId: 'water-tank-001',
        deviceType: 'WATER_TANK_NODE',
        capabilities: [
          { id: 'c1', capability: 'RELAY_CONTROL', enabled: true },
          { id: 'c2', capability: 'SOLENOID_VALVE_CONTROL', enabled: true },
          { id: 'c3', capability: 'WATER_TANK_VOLUME', enabled: true },
        ],
      };

      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.deviceCapability = {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      };

      await repo.reconcileDeviceCapabilities('tank-device-id');

      // Obsolete RELAY_CONTROL and SOLENOID_VALVE_CONTROL should be deleted
      expect(mockPrisma.deviceCapability.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2'] } },
      });

      // Missing WATER_FLOW_RATE and FAUCET_CONTROL should be created
      expect(mockPrisma.deviceCapability.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          {
            deviceId: 'tank-device-id',
            capability: 'WATER_FLOW_RATE',
            enabled: true,
            source: 'PROVISIONED',
          },
          {
            deviceId: 'tank-device-id',
            capability: 'FAUCET_CONTROL',
            enabled: true,
            source: 'PROVISIONED',
          },
        ]),
        skipDuplicates: true,
      });
    });

    it('atomically reconciles capabilities when deviceType is updated', async () => {
      const existingDevice = {
        id: 'device-id-123',
        deviceId: 'node-123',
        name: 'Node 123',
        deviceType: 'SOIL_NODE',
        accountStatus: 'ACTIVE',
        capabilities: [{ id: 'c1', capability: 'SOIL_NITROGEN', enabled: true }],
      };

      mockPrisma.device.findFirst.mockResolvedValue(existingDevice);
      mockPrisma.device.findUnique.mockResolvedValue(existingDevice);

      const updatedDevice = {
        ...existingDevice,
        deviceType: 'WATER_QUALITY_NODE',
      };

      mockPrisma.device.update.mockResolvedValue(updatedDevice);
      mockPrisma.deviceCapability = {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
      };

      vi.spyOn(repo, 'reconcileDeviceCapabilities').mockImplementation(async () => {});

      await repo.updateDevice(
        'node-123',
        { deviceType: DeviceType.WATER_QUALITY_NODE },
        'owner-id'
      );

      expect(repo.reconcileDeviceCapabilities).toHaveBeenCalledWith(
        'device-id-123',
        expect.anything()
      );
    });
  });
});
