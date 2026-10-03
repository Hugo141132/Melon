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
      deviceExternalMapping: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      deviceStatusEvent: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
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

  describe('getDeviceByCanonicalId (Regression for UUID fallback)', () => {
    it('queries using case-insensitive canonical deviceId when passed a standard string', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({ id: 'uuid-1', deviceId: 'canonical-1' });

      await repo.getDeviceByCanonicalId('canonical-1');

      expect(mockPrisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { deviceId: 'canonical-1' },
              { deviceId: { equals: 'canonical-1', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('queries using both id and canonical deviceId when passed a valid UUID string', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'canonical-1',
      });

      await repo.getDeviceByCanonicalId('11111111-1111-1111-1111-111111111111');

      expect(mockPrisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { id: '11111111-1111-1111-1111-111111111111' },
              { deviceId: '11111111-1111-1111-1111-111111111111' },
              { deviceId: { equals: '11111111-1111-1111-1111-111111111111', mode: 'insensitive' } },
            ],
          },
        })
      );
    });
  });

  describe('getDeviceByClientId (TASK-0412)', () => {
    it('queries active device by case-insensitive clientId', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 'uuid-air-1',
        deviceId: 'water-node-001',
        clientId: 'melon-esp32-air1',
        accountStatus: 'ACTIVE',
      });

      const result = await repo.getDeviceByClientId('melon-esp32-air1');

      expect(mockPrisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { clientId: 'melon-esp32-air1' },
              { clientId: { equals: 'melon-esp32-air1', mode: 'insensitive' } },
            ],
            accountStatus: 'ACTIVE',
          },
          include: { capabilities: true },
        })
      );
      expect(result?.clientId).toBe('melon-esp32-air1');
    });

    it('returns null when clientId is empty or whitespace', async () => {
      const result = await repo.getDeviceByClientId('   ');
      expect(result).toBeNull();
      expect(mockPrisma.device.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getActiveDeviceByType (TASK-0412)', () => {
    it('queries active device by deviceType', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 'uuid-soil-1',
        deviceId: 'soil-node-001',
        deviceType: 'SOIL_NODE',
        accountStatus: 'ACTIVE',
      });

      const result = await repo.getActiveDeviceByType(DeviceType.SOIL_NODE);

      expect(mockPrisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deviceType: DeviceType.SOIL_NODE,
            accountStatus: 'ACTIVE',
          },
          orderBy: { createdAt: 'asc' },
          include: { capabilities: true },
        })
      );
      expect(result?.deviceType).toBe(DeviceType.SOIL_NODE);
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

  describe('reconcileDeviceCapabilities & updateDevice', () => {
    it('reconciles WATER_TANK_NODE to exactly WATER_TANK_VOLUME and FAUCET_CONTROL (DEC-MON-089)', async () => {
      const mockDevice = {
        id: 'tank-device-id',
        deviceId: 'water-tank-001',
        deviceType: 'WATER_TANK_NODE',
        capabilities: [
          { id: 'c1', capability: 'RELAY_CONTROL', enabled: true },
          { id: 'c2', capability: 'SOLENOID_VALVE_CONTROL', enabled: true },
          { id: 'c3', capability: 'WATER_FLOW_RATE', enabled: true },
          { id: 'c4', capability: 'WATER_TANK_VOLUME', enabled: true },
        ],
      };

      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.deviceCapability = {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      };

      await repo.reconcileDeviceCapabilities('tank-device-id');

      // Obsolete RELAY_CONTROL, SOLENOID_VALVE_CONTROL, and WATER_FLOW_RATE should be deleted
      expect(mockPrisma.deviceCapability.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2', 'c3'] } },
      });

      // Missing FAUCET_CONTROL should be created
      expect(mockPrisma.deviceCapability.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
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

  describe('device_external_mappings methods (TASK-0413)', () => {
    const mockDevice = {
      id: '3216f033-4c21-4b19-adc6-365854c31704',
      deviceId: 'soil-node-jvbkdbv',
      name: 'Soil Node Bedeng 1',
      deviceType: DeviceType.SOIL_NODE,
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
      capabilities: [],
    };

    describe('getActiveExternalDeviceId', () => {
      it('returns externalDeviceId when active mapping exists for deviceId', async () => {
        mockPrisma.deviceExternalMapping.findFirst.mockResolvedValue({
          externalDeviceId: 'melon002',
        });

        const result = await repo.getActiveExternalDeviceId(
          'soil-node-jvbkdbv',
          'SOIL',
          'EXTERNAL_ML'
        );

        expect(result).toBe('melon002');
        expect(mockPrisma.deviceExternalMapping.findFirst).toHaveBeenCalledWith({
          where: {
            provider: 'EXTERNAL_ML',
            domain: 'SOIL',
            isActive: true,
            device: {
              OR: [
                { deviceId: 'soil-node-jvbkdbv' },
                { deviceId: { equals: 'soil-node-jvbkdbv', mode: 'insensitive' } },
              ],
            },
          },
          select: {
            externalDeviceId: true,
          },
        });
      });

      it('returns externalDeviceId when querying by UUID', async () => {
        mockPrisma.deviceExternalMapping.findFirst.mockResolvedValue({
          externalDeviceId: 'melon002',
        });

        const result = await repo.getActiveExternalDeviceId(
          '3216f033-4c21-4b19-adc6-365854c31704',
          'SOIL'
        );

        expect(result).toBe('melon002');
        expect(mockPrisma.deviceExternalMapping.findFirst).toHaveBeenCalledWith({
          where: {
            provider: 'EXTERNAL_ML',
            domain: 'SOIL',
            isActive: true,
            device: {
              OR: [
                { id: '3216f033-4c21-4b19-adc6-365854c31704' },
                { deviceId: '3216f033-4c21-4b19-adc6-365854c31704' },
                {
                  deviceId: { equals: '3216f033-4c21-4b19-adc6-365854c31704', mode: 'insensitive' },
                },
              ],
            },
          },
          select: {
            externalDeviceId: true,
          },
        });
      });

      it('returns null when no active mapping is found', async () => {
        mockPrisma.deviceExternalMapping.findFirst.mockResolvedValue(null);

        const result = await repo.getActiveExternalDeviceId('soil-node-jvbkdbv', 'SOIL');
        expect(result).toBeNull();
      });

      it('returns null for empty or invalid deviceIdentifier', async () => {
        expect(await repo.getActiveExternalDeviceId('', 'SOIL')).toBeNull();
        expect(await repo.getActiveExternalDeviceId(null as any, 'SOIL')).toBeNull();
      });
    });

    describe('upsertExternalMapping', () => {
      it('creates or updates mapping for resolved device', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
        const mockUpsertResult = {
          id: 'map-uuid-1234',
          deviceId: mockDevice.id,
          provider: 'EXTERNAL_ML',
          domain: 'SOIL',
          externalDeviceId: 'melon002',
          isActive: true,
          createdAt: new Date('2026-09-18T10:00:00Z'),
          updatedAt: new Date('2026-09-18T10:00:00Z'),
        };
        mockPrisma.deviceExternalMapping.upsert.mockResolvedValue(mockUpsertResult);

        const result = await repo.upsertExternalMapping({
          deviceId: 'soil-node-jvbkdbv',
          domain: 'SOIL',
          externalDeviceId: 'melon002',
        });

        expect(result.externalDeviceId).toBe('melon002');
        expect(result.canonicalDeviceId).toBe('soil-node-jvbkdbv');
        expect(mockPrisma.deviceExternalMapping.upsert).toHaveBeenCalledWith({
          where: {
            deviceId_provider_domain: {
              deviceId: mockDevice.id,
              provider: 'EXTERNAL_ML',
              domain: 'SOIL',
            },
          },
          create: {
            deviceId: mockDevice.id,
            provider: 'EXTERNAL_ML',
            domain: 'SOIL',
            externalDeviceId: 'melon002',
            isActive: true,
          },
          update: {
            externalDeviceId: 'melon002',
            isActive: true,
            updatedAt: expect.any(Date),
          },
        });
      });

      it('throws DeviceNotFoundError if target device does not exist', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(null);

        await expect(
          repo.upsertExternalMapping({
            deviceId: 'non-existent',
            domain: 'SOIL',
            externalDeviceId: 'melon002',
          })
        ).rejects.toThrow(DeviceNotFoundError);
      });
    });

    describe('getExternalMappings', () => {
      it('returns mapped DTOs for a device', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
        const mockMappings = [
          {
            id: 'map-uuid-1',
            deviceId: mockDevice.id,
            provider: 'EXTERNAL_ML',
            domain: 'SOIL',
            externalDeviceId: 'melon002',
            isActive: true,
            createdAt: new Date('2026-09-18T10:00:00Z'),
            updatedAt: new Date('2026-09-18T10:00:00Z'),
          },
        ];
        mockPrisma.deviceExternalMapping.findMany.mockResolvedValue(mockMappings);

        const result = await repo.getExternalMappings('soil-node-jvbkdbv');

        expect(result).toHaveLength(1);
        expect(result[0].externalDeviceId).toBe('melon002');
        expect(result[0].canonicalDeviceId).toBe('soil-node-jvbkdbv');
      });

      it('returns empty array if device is not found', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(null);

        const result = await repo.getExternalMappings('non-existent');
        expect(result).toEqual([]);
      });
    });

    describe('Valve Status Events (TASK-0811)', () => {
      const mockTankDevice = {
        id: '99999999-9999-9999-9999-999999999999',
        deviceId: 'water-tank-uqiwue',
        name: 'Water Tank Node',
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      it('records a valve status event and enforces 5-record retention', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockTankDevice);
        mockPrisma.deviceStatusEvent.create.mockResolvedValue({
          id: 'event-uuid-1',
          deviceId: mockTankDevice.id,
          status: 'OPEN',
          reasonCode: 'VALVE_FEEDBACK',
          recordedAt: new Date('2026-09-30T10:00:00Z'),
          receivedAt: new Date('2026-09-30T10:00:00Z'),
          metadata: { physicalState: 'OPEN' },
        });

        // Mock 6 existing records so trimming triggers
        mockPrisma.deviceStatusEvent.findMany.mockResolvedValue([
          { id: 'ev-1' },
          { id: 'ev-2' },
          { id: 'ev-3' },
          { id: 'ev-4' },
          { id: 'ev-5' },
        ]);
        mockPrisma.deviceStatusEvent.deleteMany.mockResolvedValue({ count: 2 });

        const result = await repo.recordValveStatusEvent(
          'water-tank-uqiwue',
          'OPEN',
          'VALVE_FEEDBACK',
          { physicalState: 'OPEN' }
        );

        expect(result.status).toBe('OPEN');
        expect(result.deviceId).toBe('water-tank-uqiwue');
        expect(mockPrisma.deviceStatusEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              deviceId: mockTankDevice.id,
              status: 'OPEN',
              reasonCode: 'VALVE_FEEDBACK',
            }),
          })
        );
        expect(mockPrisma.deviceStatusEvent.deleteMany).toHaveBeenCalledWith({
          where: {
            deviceId: mockTankDevice.id,
            reasonCode: { startsWith: 'VALVE_' },
            id: { notIn: ['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5'] },
          },
        });
      });

      it('throws DeviceNotFoundError if target device does not exist', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(null);

        await expect(repo.recordValveStatusEvent('unknown-tank', 'CLOSED')).rejects.toThrow(
          DeviceNotFoundError
        );
      });

      it('retrieves the latest physical valve status', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockTankDevice);
        mockPrisma.deviceStatusEvent.findFirst.mockResolvedValue({
          id: 'ev-latest',
          deviceId: mockTankDevice.id,
          status: 'CLOSED',
          reasonCode: 'VALVE_FEEDBACK',
          recordedAt: new Date('2026-09-30T10:05:00Z'),
          receivedAt: new Date('2026-09-30T10:05:00Z'),
        });

        const status = await repo.getLatestValveStatus('water-tank-uqiwue');
        expect(status).not.toBeNull();
        expect(status?.status).toBe('CLOSED');
      });

      it('returns null if no valve status exists for device', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockTankDevice);
        mockPrisma.deviceStatusEvent.findFirst.mockResolvedValue(null);

        const status = await repo.getLatestValveStatus('water-tank-uqiwue');
        expect(status).toBeNull();
      });

      it('retrieves valve status history up to specified limit', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(mockTankDevice);
        mockPrisma.deviceStatusEvent.findMany.mockResolvedValue([
          {
            id: 'ev-1',
            status: 'CLOSED',
            reasonCode: 'VALVE_FEEDBACK',
            recordedAt: new Date('2026-09-30T10:00:00Z'),
            receivedAt: new Date('2026-09-30T10:00:00Z'),
            metadata: {},
          },
          {
            id: 'ev-2',
            status: 'OPEN',
            reasonCode: 'VALVE_FEEDBACK',
            recordedAt: new Date('2026-09-30T09:50:00Z'),
            receivedAt: new Date('2026-09-30T09:50:00Z'),
            metadata: {},
          },
        ]);

        const history = await repo.getValveStatusHistory('water-tank-uqiwue', 5);
        expect(history).toHaveLength(2);
        expect(history[0].status).toBe('CLOSED');
        expect(history[1].status).toBe('OPEN');
      });
    });
  });
});
