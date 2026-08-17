import { describe, it, expect } from 'vitest';
import {
  CanonicalDeviceIdSchema,
  UpdateDeviceInputSchema,
  PublicSafeDeviceDtoSchema,
  AdminSafeDeviceDtoSchema,
  DeviceType,
  DeviceAccountStatus,
  DeviceConnectionStatus,
} from '../device';

describe('Device Contracts (TASK-0302)', () => {
  describe('CanonicalDeviceIdSchema', () => {
    it('accepts valid canonical device IDs', () => {
      expect(CanonicalDeviceIdSchema.parse('water-node-001')).toBe('water-node-001');
      expect(CanonicalDeviceIdSchema.parse('soil_node_2')).toBe('soil_node_2');
      expect(CanonicalDeviceIdSchema.parse('esp32-abc-123')).toBe('esp32-abc-123');
    });

    it('rejects invalid or translated/display device IDs', () => {
      expect(() => CanonicalDeviceIdSchema.parse('Water Node 1')).toThrow();
      expect(() => CanonicalDeviceIdSchema.parse('Node/01')).toThrow();
      expect(() => CanonicalDeviceIdSchema.parse('esp32!@#')).toThrow();
      expect(() => CanonicalDeviceIdSchema.parse('ab')).toThrow(); // too short
    });
  });

  describe('UpdateDeviceInputSchema', () => {
    it('allows Owner to update canonical deviceId and user-facing name per DEC-DEV-028', () => {
      const input = {
        deviceId: 'water-node-001-renamed',
        name: 'Updated Device Name',
        accountStatus: DeviceAccountStatus.INACTIVE,
        latitude: -7.1234,
      };
      const parsed = UpdateDeviceInputSchema.parse(input);
      expect(parsed.deviceId).toBe('water-node-001-renamed');
      expect(parsed.name).toBe('Updated Device Name');
      expect(parsed.accountStatus).toBe('INACTIVE');
    });

    it('rejects invalid canonical deviceId in update payload', () => {
      expect(() =>
        UpdateDeviceInputSchema.parse({
          deviceId: 'Invalid Device ID With Spaces',
        })
      ).toThrow();

      expect(() =>
        UpdateDeviceInputSchema.parse({
          deviceId: 'UPPERCASE_NODE_ID',
        })
      ).toThrow();
    });

    it('rejects strict non-allowlisted / server-controlled fields', () => {
      expect(() =>
        UpdateDeviceInputSchema.parse({
          name: 'Updated Name',
          connectionStatus: DeviceConnectionStatus.ONLINE, // forbidden in update schema
        } as any)
      ).toThrow();

      expect(() =>
        UpdateDeviceInputSchema.parse({
          name: 'Updated Name',
          lastSeenAt: new Date(), // forbidden in update schema
        } as any)
      ).toThrow();

      expect(() =>
        UpdateDeviceInputSchema.parse({
          name: 'Updated Name',
          capabilities: ['FAUCET_CONTROL'], // forbidden in update schema
        } as any)
      ).toThrow();
    });
  });

  describe('PublicSafeDeviceDtoSchema', () => {
    it('parses valid public safe DTO with deviceId for Owner view', () => {
      const now = new Date();
      const dto = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'water-node-001',
        siteId: null,
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.ONLINE,
        firmwareVersion: '1.0.0',
        hardwareRevision: 'v1',
        schemaVersion: '1.0',
        lastSeenAt: now,
        lastMessageAt: now,
        latitude: -6.2,
        longitude: 106.8,
        createdAt: now,
        updatedAt: now,
        deactivatedAt: null,
        capabilities: ['WATER_TELEMETRY'],
      };

      const parsed = PublicSafeDeviceDtoSchema.parse(dto);
      expect(parsed.deviceId).toBe('water-node-001');
      expect((parsed as any).deviceSecret).toBeUndefined();
    });

    it('parses valid public safe DTO without deviceId for Admin role projection via AdminSafeDeviceDtoSchema (DEC-DEV-028)', () => {
      const now = new Date();
      const dto = {
        id: '11111111-1111-1111-1111-111111111111',
        siteId: null,
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.ONLINE,
        firmwareVersion: '1.0.0',
        hardwareRevision: 'v1',
        schemaVersion: '1.0',
        lastSeenAt: now,
        lastMessageAt: now,
        latitude: -6.2,
        longitude: 106.8,
        createdAt: now,
        updatedAt: now,
        deactivatedAt: null,
        capabilities: ['WATER_TELEMETRY'],
      };

      const parsed = AdminSafeDeviceDtoSchema.parse(dto);
      expect(parsed.id).toBe('11111111-1111-1111-1111-111111111111');
      expect((parsed as any).deviceId).toBeUndefined();
      expect(parsed.name).toBe('Water Node 1');
    });
  });
});
