import { describe, it, expect } from 'vitest';
import { SoilTelemetryDataSchema, SoilTelemetryPayloadSchema, MonitoringStatus } from '../index';

describe('Soil Telemetry Contract Schemas', () => {
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
});
