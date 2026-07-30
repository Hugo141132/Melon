import { describe, it, expect } from 'vitest';
import {
  CanonicalDeviceIdSchema,
  CreateDeviceInputSchema,
  UpdateDeviceInputSchema,
  PublicSafeDeviceDtoSchema,
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

  describe('CreateDeviceInputSchema', () => {
    it('validates a complete and valid create device payload for supported device profile', () => {
      const input = {
        name: 'Water Quality Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
      };
      const parsed = CreateDeviceInputSchema.parse(input);
      expect(parsed.name).toBe('Water Quality Node 1');
      expect(parsed.deviceType).toBe(DeviceType.WATER_QUALITY_NODE);
      expect(parsed.deviceId).toBeUndefined();
    });

    it('accepts explicit deviceId if provided by backend caller', () => {
      const input = {
        deviceId: 'water-quality-node-001',
        name: 'Water Quality Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
      };
      const parsed = CreateDeviceInputSchema.parse(input);
      expect(parsed.deviceId).toBe('water-quality-node-001');
    });

    it('rejects legacy device creation types (WATER_NODE, COMBINED_NODE)', () => {
      expect(() =>
        CreateDeviceInputSchema.parse({
          name: 'Legacy Node',
          deviceType: 'WATER_NODE' as any,
        })
      ).toThrow();

      expect(() =>
        CreateDeviceInputSchema.parse({
          name: 'Legacy Node',
          deviceType: 'COMBINED_NODE' as any,
        })
      ).toThrow();
    });

    it('rejects out of bound coordinates', () => {
      expect(() =>
        CreateDeviceInputSchema.parse({
          deviceId: 'node-01',
          name: 'Node 1',
          deviceType: DeviceType.SOIL_NODE,
          latitude: -91,
        })
      ).toThrow();

      expect(() =>
        CreateDeviceInputSchema.parse({
          deviceId: 'node-01',
          name: 'Node 1',
          deviceType: DeviceType.SOIL_NODE,
          longitude: 181,
        })
      ).toThrow();
    });
  });

  describe('UpdateDeviceInputSchema', () => {
    it('allows permitted update fields', () => {
      const input = {
        name: 'Updated Device Name',
        accountStatus: DeviceAccountStatus.INACTIVE,
        latitude: -7.1234,
      };
      const parsed = UpdateDeviceInputSchema.parse(input);
      expect(parsed.name).toBe('Updated Device Name');
      expect(parsed.accountStatus).toBe('INACTIVE');
    });

    it('rejects strict non-allowlisted / read-only fields', () => {
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
    });
  });

  describe('PublicSafeDeviceDtoSchema', () => {
    it('parses valid public safe DTO without secret fields', () => {
      const now = new Date();
      const dto = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'water-node-001',
        siteId: null,
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_NODE,
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
  });
});
