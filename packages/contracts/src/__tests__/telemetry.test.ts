import { describe, it, expect } from 'vitest';
import {
  SoilTelemetryDataSchema,
  SoilTelemetryPayloadSchema,
  SoilMonitoringResponseDtoSchema,
  WaterMonitoringResponseDtoSchema,
  LatestMonitoringSnapshotDtoSchema,
  MonitoringStatus,
  DeviceType,
  DeviceConnectionStatus,
} from '../index';

describe('Soil & Water Telemetry Contract Schemas', () => {
  describe('SoilTelemetryDataSchema', () => {
    it('parses valid full soil data', () => {
      const input = {
        nitrogen: 45.2,
        phosphorus: 21.8,
        potassium: 73.1,
        temperature: 28.4,
        moisture: 67.3,
        ph: 6.5,
        ec: 1.42,
        status: 'NORMAL',
      };

      const result = SoilTelemetryDataSchema.parse(input);
      expect(result.nitrogen).toBe(45.2);
      expect(result.phosphorus).toBe(21.8);
      expect(result.potassium).toBe(73.1);
      expect(result.temperature).toBe(28.4);
      expect(result.moisture).toBe(67.3);
      expect(result.ph).toBe(6.5);
      expect(result.ec).toBe(1.42);
      expect(result.status).toBe(MonitoringStatus.NORMAL);
    });

    it('PRESERVES NUMERIC 0 and does not convert to null', () => {
      const input = {
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        temperature: 0,
        moisture: 0,
        ph: 0,
        ec: 0,
        status: 'NORMAL',
      };

      const result = SoilTelemetryDataSchema.parse(input);
      expect(result.nitrogen).toBe(0);
      expect(result.phosphorus).toBe(0);
      expect(result.potassium).toBe(0);
      expect(result.temperature).toBe(0);
      expect(result.moisture).toBe(0);
      expect(result.ph).toBe(0);
      expect(result.ec).toBe(0);
    });

    it('PRESERVES NULL and MISSING values as NULL', () => {
      const input = {
        nitrogen: null,
        // phosphorus missing
        // potassium missing
        ph: 6.5,
      };

      const result = SoilTelemetryDataSchema.parse(input);
      expect(result.nitrogen).toBeNull();
      expect(result.phosphorus).toBeNull();
      expect(result.potassium).toBeNull();
      expect(result.temperature).toBeNull();
      expect(result.moisture).toBeNull();
      expect(result.ph).toBe(6.5);
      expect(result.ec).toBeNull();
      expect(result.status).toBeNull();
    });

    it('rejects non-finite numeric values (NaN, Infinity)', () => {
      expect(() =>
        SoilTelemetryDataSchema.parse({
          nitrogen: NaN,
        })
      ).toThrow();

      expect(() =>
        SoilTelemetryDataSchema.parse({
          temperature: Infinity,
        })
      ).toThrow();
    });

    it('rejects invalid status values', () => {
      expect(() =>
        SoilTelemetryDataSchema.parse({
          status: 'SUPER_GOOD',
        })
      ).toThrow();
    });
  });

  describe('SoilTelemetryPayloadSchema', () => {
    it('parses valid soil telemetry payload envelope', () => {
      const payload = {
        schemaVersion: '1.0',
        messageId: '00000000-0000-0000-0000-000000000001',
        deviceId: 'soil-node-001',
        siteId: 'site-01',
        sequence: 12,
        recordedAt: '2026-07-27T13:45:00+07:00',
        data: {
          nitrogen: 45.2,
          ph: 6.5,
          status: 'NORMAL',
        },
      };

      const result = SoilTelemetryPayloadSchema.parse(payload);
      expect(result.schemaVersion).toBe('1.0');
      expect(result.messageId).toBe('00000000-0000-0000-0000-000000000001');
      expect(result.deviceId).toBe('soil-node-001');
      expect(result.data.nitrogen).toBe(45.2);
      expect(result.data.ph).toBe(6.5);
      expect(result.data.status).toBe(MonitoringStatus.NORMAL);
      expect(result.data.potassium).toBeNull();
    });
  });

  describe('SoilMonitoringResponseDtoSchema', () => {
    it('parses valid soil monitoring response DTO', () => {
      const dto = {
        deviceId: 'soil-node-001',
        recordedAt: '2026-08-01T10:00:00.000Z',
        receivedAt: '2026-08-01T10:00:01.000Z',
        isStale: false,
        data: {
          nitrogen: 45.2,
          phosphorus: 21.8,
          potassium: 73.1,
          temperature: 28.4,
          moisture: 67.3,
          ph: 6.5,
          ec: 1.42,
          status: MonitoringStatus.NORMAL,
        },
      };

      const result = SoilMonitoringResponseDtoSchema.parse(dto);
      expect(result.deviceId).toBe('soil-node-001');
      expect(result.data.nitrogen).toBe(45.2);
      expect(result.isStale).toBe(false);
    });
  });

  describe('WaterMonitoringResponseDtoSchema', () => {
    it('parses valid water monitoring response DTO', () => {
      const dto = {
        deviceId: 'water-node-001',
        recordedAt: '2026-08-01T10:00:00.000Z',
        receivedAt: '2026-08-01T10:00:01.000Z',
        isStale: false,
        data: {
          ph: 6.8,
          tds: 420,
          ec: 1.5,
          tankVolume: 450,
          flowRate: 12.5,
          status: MonitoringStatus.NORMAL,
        },
      };

      const result = WaterMonitoringResponseDtoSchema.parse(dto);
      expect(result.deviceId).toBe('water-node-001');
      expect(result.data.ph).toBe(6.8);
      expect(result.data.tds).toBe(420);
      expect(result.data.tankVolume).toBe(450);
      expect(result.isStale).toBe(false);
    });

    it('preserves numeric 0 for water telemetry parameters', () => {
      const dto = {
        deviceId: 'water-node-001',
        recordedAt: '2026-08-01T10:00:00.000Z',
        receivedAt: '2026-08-01T10:00:01.000Z',
        isStale: false,
        data: {
          ph: 0,
          tds: 0,
          ec: 0,
          tankVolume: 0,
          flowRate: 0,
          status: 'NORMAL',
        },
      };

      const result = WaterMonitoringResponseDtoSchema.parse(dto);
      expect(result.data.ph).toBe(0);
      expect(result.data.tds).toBe(0);
      expect(result.data.ec).toBe(0);
      expect(result.data.tankVolume).toBe(0);
      expect(result.data.flowRate).toBe(0);
    });
  });

  describe('LatestMonitoringSnapshotDtoSchema', () => {
    it('parses combined monitoring snapshot DTO with soil and water telemetry', () => {
      const snapshot = {
        deviceId: 'device-101',
        deviceType: DeviceType.WATER_TANK_NODE,
        connectionStatus: DeviceConnectionStatus.ONLINE,
        lastSeenAt: '2026-08-01T10:00:00.000Z',
        soil: null,
        water: {
          deviceId: 'device-101',
          recordedAt: '2026-08-01T10:00:00.000Z',
          receivedAt: '2026-08-01T10:00:01.000Z',
          isStale: false,
          data: {
            ph: 6.5,
            tds: 350,
            ec: 1.2,
            tankVolume: 500,
            flowRate: 10.0,
            status: 'NORMAL',
          },
        },
      };

      const result = LatestMonitoringSnapshotDtoSchema.parse(snapshot);
      expect(result.deviceId).toBe('device-101');
      expect(result.deviceType).toBe(DeviceType.WATER_TANK_NODE);
      expect(result.connectionStatus).toBe(DeviceConnectionStatus.ONLINE);
      expect(result.soil).toBeNull();
      expect(result.water?.data.tankVolume).toBe(500);
    });
  });
});
