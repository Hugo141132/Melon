import { describe, it, expect } from 'vitest';
import {
  PublicSafeDeviceDtoSchema,
  AdminSafeDeviceDtoSchema,
  UpdateDeviceInputSchema,
  DeviceQueryInputSchema,
  DeviceType,
  DeviceAccountStatus,
  DeviceConnectionStatus,
} from '@kebun-melon/contracts';

describe('Device Registry UI Component & Schema Contract Tests (TASK-0302)', () => {
  it('1. Validates schema parsing for populated device DTO in list UI (Owner view with deviceId)', () => {
    const validDevice = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      deviceId: 'water-node-001',
      siteId: null,
      name: 'Water Quality Node 1',
      deviceType: DeviceType.WATER_QUALITY_NODE,
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
      firmwareVersion: '1.0.0',
      hardwareRevision: 'v1.0',
      schemaVersion: '1.0',
      lastSeenAt: new Date(),
      lastMessageAt: new Date(),
      latitude: -6.2001,
      longitude: 106.8168,
      createdAt: new Date(),
      updatedAt: new Date(),
      deactivatedAt: null,
      capabilities: ['WATER_TELEMETRY', 'LOCATION', 'FAUCET_CONTROL'],
    };

    const parsed = PublicSafeDeviceDtoSchema.parse(validDevice);
    expect(parsed.deviceId).toBe('water-node-001');
    expect(parsed.name).toBe('Water Quality Node 1');
    expect(parsed.connectionStatus).toBe('ONLINE');
  });

  it('2. Validates schema parsing for Admin role projection where canonical deviceId is concealed', () => {
    const adminProjectedDevice = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      // deviceId omitted
      siteId: null,
      name: 'Water Quality Node 1',
      deviceType: DeviceType.WATER_QUALITY_NODE,
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
      firmwareVersion: '1.0.0',
      hardwareRevision: 'v1.0',
      schemaVersion: '1.0',
      lastSeenAt: new Date(),
      lastMessageAt: new Date(),
      latitude: -6.2001,
      longitude: 106.8168,
      createdAt: new Date(),
      updatedAt: new Date(),
      deactivatedAt: null,
      capabilities: ['WATER_TELEMETRY'],
    };

    const parsed = AdminSafeDeviceDtoSchema.parse(adminProjectedDevice);
    expect((parsed as any).deviceId).toBeUndefined();
    expect(parsed.name).toBe('Water Quality Node 1');
    expect(parsed.id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('3. Enforces secret/credential exclusion in UI device DTOs', () => {
    const deviceWithSecrets = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      deviceId: 'water-node-001',
      siteId: null,
      name: 'Water Quality Node 1',
      deviceType: DeviceType.WATER_QUALITY_NODE,
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
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
      capabilities: [],
      deviceSecret: 'secret-12345',
      mqttPassword: 'password123',
    };

    const parsed = PublicSafeDeviceDtoSchema.parse(deviceWithSecrets);
    expect((parsed as any).deviceSecret).toBeUndefined();
    expect((parsed as any).mqttPassword).toBeUndefined();
  });

  it('4. Validates query input contract for device search and filtering', () => {
    const defaultQuery = DeviceQueryInputSchema.parse({});
    expect(defaultQuery.page).toBe(1);
    expect(defaultQuery.pageSize).toBe(20);
    expect(defaultQuery.sort).toBe('createdAt:desc');

    const customQuery = DeviceQueryInputSchema.parse({
      page: 2,
      pageSize: 10,
      deviceType: DeviceType.SOIL_NODE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
      search: 'node-01',
    });
    expect(customQuery.page).toBe(2);
    expect(customQuery.deviceType).toBe('SOIL_NODE');
    expect(customQuery.connectionStatus).toBe('ONLINE');
    expect(customQuery.search).toBe('node-01');
  });

  it('5. Validates Owner Edit Device modal payload schema contract with canonical deviceId rename', () => {
    const editInput = UpdateDeviceInputSchema.parse({
      deviceId: 'soil-node-renamed-001',
      name: 'Soil Node Blok A Updated',
      latitude: -6.21,
    });

    expect(editInput.deviceId).toBe('soil-node-renamed-001');
    expect(editInput.name).toBe('Soil Node Blok A Updated');
    expect(editInput.latitude).toBe(-6.21);

    expect(() =>
      UpdateDeviceInputSchema.parse({
        name: 'Node',
        connectionStatus: 'ONLINE', // forbidden server-controlled field
      } as any)
    ).toThrow();
  });

  it('6. Validates WATER_TANK_NODE capability display contains FAUCET_CONTROL and excludes RELAY_CONTROL / SOLENOID_VALVE_CONTROL', () => {
    const tankDevice = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      deviceId: 'water-tank-node-001',
      siteId: null,
      name: 'Water Tank Node 1',
      deviceType: DeviceType.WATER_TANK_NODE,
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
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
      capabilities: ['WATER_TANK_VOLUME', 'WATER_FLOW_RATE', 'FAUCET_CONTROL'],
    };

    const parsed = PublicSafeDeviceDtoSchema.parse(tankDevice);
    expect(parsed.capabilities).toContain('WATER_TANK_VOLUME');
    expect(parsed.capabilities).toContain('WATER_FLOW_RATE');
    expect(parsed.capabilities).toContain('FAUCET_CONTROL');
    expect(parsed.capabilities).not.toContain('RELAY_CONTROL');
    expect(parsed.capabilities).not.toContain('SOLENOID_VALVE_CONTROL');
  });
});
