import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SoilWaterMqttAdapter,
  SOIL_WATER_TOPICS,
  soilWaterMqttAdapter,
} from '../mqtt/soil-water-adapter';
import { GatewayEnv } from '../config/env';
import { DeviceType } from '@kebun-melon/contracts';
import { publishRealtimeEvent } from '../events/webhook';

vi.mock('../events/webhook', () => ({
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('SoilWaterMqttAdapter (TASK-0412 / Soil & Water MQTT Ingestion)', () => {
  let adapter: SoilWaterMqttAdapter;
  let mockMqttClient: any;
  let mockTelemetryRepo: any;
  let mockDeviceRepo: any;
  let mockEnv: GatewayEnv;

  const mockSoilDevice = {
    id: 'soil-uuid-001',
    deviceId: 'melon-esp32-tanah1',
    siteId: 'site-01',
    deviceType: DeviceType.SOIL_NODE,
    accountStatus: 'ACTIVE',
  };

  const mockWaterDevice = {
    id: 'water-uuid-001',
    deviceId: 'melon-esp32-air1',
    siteId: 'site-01',
    deviceType: DeviceType.WATER_QUALITY_NODE,
    accountStatus: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockMqttClient = {
      isConnected: vi.fn().mockReturnValue(true),
      subscribe: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn().mockImplementation((handler) => {
        mockMqttClient._handler = handler;
        return vi.fn();
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    mockTelemetryRepo = {
      ingestSoilReading: vi.fn().mockResolvedValue({
        readingId: 'soil-reading-uuid-123',
        deviceId: 'soil-uuid-001',
        canonicalDeviceId: 'melon-esp32-tanah1',
        messageId: 'msg-soil-001',
        recordedAt: new Date('2026-09-15T10:00:00.000Z'),
        receivedAt: new Date('2026-09-15T10:00:01.000Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      }),
      ingestWaterReading: vi.fn().mockResolvedValue({
        readingId: 'water-reading-uuid-456',
        deviceId: 'water-uuid-001',
        canonicalDeviceId: 'melon-esp32-air1',
        messageId: 'msg-water-001',
        recordedAt: new Date('2026-09-15T10:05:00.000Z'),
        receivedAt: new Date('2026-09-15T10:05:01.000Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      }),
    };

    mockDeviceRepo = {
      getDeviceByClientId: vi.fn().mockImplementation(async (clientId: string) => {
        if (clientId === 'melon-esp32-tanah1') return mockSoilDevice;
        if (clientId === 'melon-esp32-air1') return mockWaterDevice;
        return null;
      }),
      getActiveDeviceByType: vi.fn().mockImplementation(async (deviceType: DeviceType) => {
        if (deviceType === DeviceType.SOIL_NODE) return mockSoilDevice;
        if (deviceType === DeviceType.WATER_QUALITY_NODE) return mockWaterDevice;
        return null;
      }),
      getDeviceByCanonicalId: vi.fn().mockImplementation(async (canonicalId: string) => {
        if (canonicalId === 'melon-esp32-tanah1') return mockSoilDevice;
        if (canonicalId === 'melon-esp32-air1') return mockWaterDevice;
        return null;
      }),
      getDevices: vi.fn().mockImplementation(async ({ deviceType }) => {
        if (deviceType === DeviceType.SOIL_NODE) {
          return { items: [mockSoilDevice], total: 1 };
        }
        if (deviceType === DeviceType.WATER_QUALITY_NODE) {
          return { items: [mockWaterDevice], total: 1 };
        }
        return { items: [], total: 0 };
      }),
      updateDeviceLastSeen: vi.fn().mockResolvedValue(undefined),
      updateDeviceStatus: vi.fn().mockResolvedValue(undefined),
      getActiveExternalDeviceId: vi.fn().mockImplementation(async (id: string, domain: string) => {
        if (domain === 'SOIL') return 'melon002';
        if (domain === 'WATER') return 'water001';
        return null;
      }),
    };

    mockEnv = {
      NODE_ENV: 'test',
      APP_ENV: 'local',
      PORT: 3001,
      HOST: '0.0.0.0',
      MQTT_BROKER_URL: 'mqtt://localhost:1883',
      MQTT_GATEWAY_CLIENT_ID: 'gateway-test',
      ENABLE_FAUCET_CONTROL: false,
      SOIL_WATER_ADAPTER_ENABLED: true,
      SOIL_MQTT_PUB_TOPIC: 'melon/sensor-tanah/data-2424600050',
      SOIL_MQTT_SUB_TOPIC: 'melon/ai-tanah/rekomendasi-2424600050',
      WATER_MQTT_PUB_TOPIC: 'melon/sensor-air/data-2424600050',
      WATER_MQTT_SUB_TOPIC: 'melon/ai-air/rekomendasi-2424600050',
      EXTERNAL_ML_DEBOUNCE_MS: 0,
      EXTERNAL_ML_TIMEOUT_MS: 3000,
      EXTERNAL_ML_MAX_STALENESS_SECONDS: 300,
      EXTERNAL_ML_RECOMMENDATION_ENABLED: true,
    } as GatewayEnv;

    adapter = new SoilWaterMqttAdapter({
      env: mockEnv,
      mqttClient: mockMqttClient,
      telemetryRepo: mockTelemetryRepo,
      deviceRepo: mockDeviceRepo,
    });
  });

  describe('Topic Specifications', () => {
    it('defines exact required topics according to TASK-0412 spec', () => {
      expect(SOIL_WATER_TOPICS.SOIL_DATA).toBe('melon/sensor-tanah/data-2424600050');
      expect(SOIL_WATER_TOPICS.SOIL_RECOMMENDATION).toBe('melon/ai-tanah/rekomendasi-2424600050');
      expect(SOIL_WATER_TOPICS.WATER_DATA).toBe('melon/sensor-air/data-2424600050');
      expect(SOIL_WATER_TOPICS.WATER_RECOMMENDATION).toBe('melon/ai-air/rekomendasi-2424600050');
    });

    it('supports configurable topics from environment variables', () => {
      const customEnv = {
        ...mockEnv,
        SOIL_MQTT_PUB_TOPIC: 'custom/sensor-tanah/data',
        SOIL_MQTT_SUB_TOPIC: 'custom/ai-tanah/rekomendasi',
        WATER_MQTT_PUB_TOPIC: 'custom/sensor-air/data',
        WATER_MQTT_SUB_TOPIC: 'custom/ai-air/rekomendasi',
      } as GatewayEnv;

      const customAdapter = new SoilWaterMqttAdapter({
        env: customEnv,
        mqttClient: mockMqttClient,
        deviceRepo: mockDeviceRepo,
        telemetryRepo: mockTelemetryRepo,
      });

      expect(customAdapter.getSoilDataTopic()).toBe('custom/sensor-tanah/data');
      expect(customAdapter.getSoilRecommendationTopic()).toBe('custom/ai-tanah/rekomendasi');
      expect(customAdapter.getWaterDataTopic()).toBe('custom/sensor-air/data');
      expect(customAdapter.getWaterRecommendationTopic()).toBe('custom/ai-air/rekomendasi');
    });
  });

  describe('Soil Telemetry Processing', () => {
    it('ingests canonical envelope payload successfully', async () => {
      const payload = {
        schemaVersion: '1.0',
        messageId: 'msg-soil-001',
        clientId: 'melon-esp32-tanah1',
        sentAt: '2026-09-15T10:00:00.000Z',
        data: {
          nitrogen: 45,
          phosphorus: 30,
          potassium: 120,
          temperature: 28.5,
          moisture: 65.2,
          ph: 6.8,
          ec: 1.4,
          status: 'NORMAL',
        },
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(true);
      expect(result.readingId).toBe('soil-reading-uuid-123');
      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-tanah1',
          nitrogen: 45,
          phosphorus: 30,
          potassium: 120,
          temperature: 28.5,
          moisture: 65.2,
          ph: 6.8,
          ec: 1.4,
          status: 'NORMAL',
        })
      );
      expect(publishRealtimeEvent).toHaveBeenCalledWith(
        mockEnv,
        'telemetry.soil.updated',
        expect.objectContaining({
          readingId: 'soil-reading-uuid-123',
          canonicalDeviceId: 'melon-esp32-tanah1',
        }),
        'melon-esp32-tanah1'
      );
      expect(publishRealtimeEvent).toHaveBeenCalledWith(
        mockEnv,
        'device.status.updated',
        expect.objectContaining({
          canonicalDeviceId: 'melon-esp32-tanah1',
          connectionStatus: 'ONLINE',
        }),
        'melon-esp32-tanah1'
      );
    });

    it('ingests flat payload with abbreviated keys (n, p, k, temp, hum) when hardware clientId is included', async () => {
      const payload = {
        clientId: 'melon-esp32-tanah1',
        n: 50,
        p: 25,
        k: 110,
        temp: 29.1,
        hum: 70.0,
        ph: 6.5,
        ec: 1.5,
        status: 'WARNING',
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(true);
      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-tanah1',
          nitrogen: 50,
          phosphorus: 25,
          potassium: 110,
          temperature: 29.1,
          moisture: 70.0,
          ph: 6.5,
          ec: 1.5,
          status: 'WARNING',
        })
      );
    });

    it('ingests real captured hardware soil payload using "device" and N, P, K, temp, moisture, ec, ph', async () => {
      const livePayload = {
        device: 'melon-esp32-tanah1',
        N: 9,
        P: 13,
        K: 31,
        temp: 28.9,
        moisture: 16.7,
        ec: 194,
        ph: 6.9,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(livePayload)));

      expect(result.success).toBe(true);
      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-tanah1',
          nitrogen: 9,
          phosphorus: 13,
          potassium: 31,
          temperature: 28.9,
          moisture: 16.7,
          ec: 194,
          ph: 6.9,
        })
      );
    });

    it('ingests hardware soil payload when device client ID includes hardware chip/MAC suffix', async () => {
      const livePayload = {
        device: 'melon-esp32-tanah1-7d077000',
        N: 9,
        P: 13,
        K: 31,
        temp: 28.9,
        moisture: 16.7,
        ec: 194,
        ph: 6.9,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(livePayload)));

      expect(result.success).toBe(true);
      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-tanah1',
        })
      );
    });

    it('handles duplicate message gracefully without throwing', async () => {
      mockTelemetryRepo.ingestSoilReading.mockResolvedValueOnce({
        readingId: 'soil-reading-dup',
        deviceId: 'soil-uuid-001',
        isDuplicate: true,
      });

      const payload = {
        clientId: 'melon-esp32-tanah1',
        n: 40,
        p: 20,
        k: 100,
        temp: 27,
        hum: 60,
        ph: 7.0,
        ec: 1.2,
      };
      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      // Duplicate should not trigger webhook
      expect(publishRealtimeEvent).not.toHaveBeenCalled();
    });

    it('rejects malformed soil data payload missing required metric fields', async () => {
      const payload = { clientId: 'melon-esp32-tanah1', invalid: 'payload' };
      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
      expect(mockTelemetryRepo.ingestSoilReading).not.toHaveBeenCalled();
    });

    it('rejects soil telemetry payload when hardware clientId is missing', async () => {
      const payload = {
        n: 50,
        p: 25,
        k: 110,
        temp: 29.1,
        hum: 70.0,
        ph: 6.5,
        ec: 1.5,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('MISSING_CLIENT_ID');
      expect(mockTelemetryRepo.ingestSoilReading).not.toHaveBeenCalled();
    });

    it('rejects soil telemetry payload from unknown hardware clientId without falling back to active device', async () => {
      const payload = {
        clientId: 'unknown-soil-hardware-999',
        n: 50,
        p: 25,
        k: 110,
        temp: 29.1,
        hum: 70.0,
        ph: 6.5,
        ec: 1.5,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestSoilReading).not.toHaveBeenCalled();
    });

    it('rejects soil telemetry payload if device type is not SOIL_NODE (e.g. water client on soil topic)', async () => {
      const payload = {
        clientId: 'melon-esp32-air1',
        n: 50,
        p: 25,
        k: 110,
        temp: 29.1,
        hum: 70.0,
        ph: 6.5,
        ec: 1.5,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestSoilReading).not.toHaveBeenCalled();
    });

    it('rejects soil telemetry payload if device accountStatus is not ACTIVE', async () => {
      (mockDeviceRepo.getDeviceByClientId as any).mockResolvedValueOnce({
        ...mockSoilDevice,
        accountStatus: 'SUSPENDED',
      });
      adapter.clearDeviceCache();

      const payload = {
        clientId: 'melon-esp32-tanah1',
        n: 50,
        p: 25,
        k: 110,
        temp: 29.1,
        hum: 70.0,
        ph: 6.5,
        ec: 1.5,
      };

      const result = await adapter.handleInboundSoilData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestSoilReading).not.toHaveBeenCalled();
    });
  });

  describe('Water Quality Telemetry Processing', () => {
    it('ingests canonical envelope water quality payload successfully', async () => {
      const payload = {
        schemaVersion: '1.0',
        messageId: 'msg-water-001',
        clientId: 'melon-esp32-air1',
        sentAt: '2026-09-15T10:05:00.000Z',
        data: {
          ph: 7.2,
          tds: 450,
          ec: 0.9,
          status: 'NORMAL',
        },
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(true);
      expect(result.readingId).toBe('water-reading-uuid-456');
      expect(mockTelemetryRepo.ingestWaterReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-air1',
          ph: 7.2,
          tds: 450,
          ec: 0.9,
          status: 'NORMAL',
        })
      );
      expect(publishRealtimeEvent).toHaveBeenCalledWith(
        mockEnv,
        'telemetry.water.updated',
        expect.objectContaining({
          readingId: 'water-reading-uuid-456',
          canonicalDeviceId: 'melon-esp32-air1',
        }),
        'melon-esp32-air1'
      );
      expect(publishRealtimeEvent).toHaveBeenCalledWith(
        mockEnv,
        'device.status.updated',
        expect.objectContaining({
          canonicalDeviceId: 'melon-esp32-air1',
          connectionStatus: 'ONLINE',
        }),
        'melon-esp32-air1'
      );
    });

    it('ingests flat water quality payload when hardware clientId is included', async () => {
      const payload = {
        clientId: 'melon-esp32-air1',
        ph: 6.9,
        tds: 520,
        ec: 1.1,
        status: 'CRITICAL',
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(true);
      expect(mockTelemetryRepo.ingestWaterReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-air1',
          ph: 6.9,
          tds: 520,
          ec: 1.1,
          status: 'CRITICAL',
        })
      );
    });

    it('ingests real captured hardware water quality payload using "water" object and "device_code"', async () => {
      const livePayload = {
        water: {
          ph: 14.08,
          tds: 76,
          ec: 82,
          battery: 50,
        },
        device_code: 'STATION-001',
        latitude: -7.197,
        longitude: 113.239,
        system_voltage: 8.164,
        system_current_mA: null,
        system_power_mW: 0,
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(livePayload)));

      expect(result.success).toBe(true);
      expect(mockTelemetryRepo.ingestWaterReading).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'melon-esp32-air1',
          ph: 14.08,
          tds: 76,
          ec: 82,
        })
      );
    });

    it('rejects water quality payload with unknown device_code without bypassing validation', async () => {
      const unknownPayload = {
        water: {
          ph: 7.0,
          tds: 100,
          ec: 1.0,
        },
        device_code: 'UNKNOWN_STATION_999',
      };

      const result = await adapter.handleInboundWaterData(
        Buffer.from(JSON.stringify(unknownPayload))
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestWaterReading).not.toHaveBeenCalled();
    });

    it('rejects malformed water quality payload', async () => {
      const payload = { clientId: 'melon-esp32-air1', notAWaterReading: 123 };
      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
      expect(mockTelemetryRepo.ingestWaterReading).not.toHaveBeenCalled();
    });

    it('rejects water quality telemetry payload when hardware clientId is missing', async () => {
      const payload = {
        ph: 6.9,
        tds: 520,
        ec: 1.1,
        status: 'CRITICAL',
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('MISSING_CLIENT_ID');
      expect(mockTelemetryRepo.ingestWaterReading).not.toHaveBeenCalled();
    });

    it('rejects water quality telemetry payload from unknown hardware clientId', async () => {
      const payload = {
        clientId: 'unknown-water-hardware-888',
        ph: 6.9,
        tds: 520,
        ec: 1.1,
        status: 'CRITICAL',
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestWaterReading).not.toHaveBeenCalled();
    });

    it('rejects water quality telemetry payload if device type is not WATER_QUALITY_NODE', async () => {
      const payload = {
        clientId: 'melon-esp32-tanah1',
        ph: 6.9,
        tds: 520,
        ec: 1.1,
        status: 'CRITICAL',
      };

      const result = await adapter.handleInboundWaterData(Buffer.from(JSON.stringify(payload)));

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNKNOWN_DEVICE_CLIENT_ID');
      expect(mockTelemetryRepo.ingestWaterReading).not.toHaveBeenCalled();
    });
  });

  describe('Recommendation Publishing (Downstream AI Topics)', () => {
    it('publishes recommendation to soil AI recommendation topic with QoS 1', async () => {
      const recommendation = {
        deviceId: 'melon-esp32-tanah1',
        action: 'ADD_FERTILIZER_K',
        targetNitrogen: 60,
        targetPotassium: 150,
        generatedAt: '2026-09-15T10:10:00.000Z',
      };

      const published = await adapter.publishSoilRecommendation(recommendation);

      expect(published).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        SOIL_WATER_TOPICS.SOIL_RECOMMENDATION,
        JSON.stringify(recommendation),
        1,
        false
      );
    });

    it('publishes recommendation to water AI recommendation topic with QoS 1', async () => {
      const recommendation = {
        deviceId: 'melon-esp32-air1',
        action: 'ADJUST_PH_DOWN',
        targetPh: 6.5,
        generatedAt: '2026-09-15T10:10:00.000Z',
      };

      const published = await adapter.publishWaterRecommendation(recommendation);

      expect(published).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        SOIL_WATER_TOPICS.WATER_RECOMMENDATION,
        JSON.stringify(recommendation),
        1,
        false
      );
    });

    it('returns false if MQTT client is not bound', async () => {
      const unboundAdapter = new SoilWaterMqttAdapter();
      const published = await unboundAdapter.publishSoilRecommendation({ test: 1 });
      expect(published).toBe(false);
    });
  });

  describe('Lifecycle and Message Routing', () => {
    it('subscribes to both soil and water data topics on start()', async () => {
      await adapter.start();

      expect(mockMqttClient.subscribe).toHaveBeenCalledWith([
        SOIL_WATER_TOPICS.SOIL_DATA,
        SOIL_WATER_TOPICS.WATER_DATA,
      ]);
      expect(mockMqttClient.onMessage).toHaveBeenCalled();
    });

    it('routes incoming MQTT messages to correct processor based on topic', async () => {
      await adapter.start();
      const handler = mockMqttClient._handler;
      expect(handler).toBeDefined();

      const soilPayload = Buffer.from(
        JSON.stringify({
          clientId: 'melon-esp32-tanah1',
          n: 40,
          p: 20,
          k: 100,
          temp: 25,
          hum: 60,
          ph: 6.8,
          ec: 1.2,
        })
      );
      const waterPayload = Buffer.from(
        JSON.stringify({ clientId: 'melon-esp32-air1', ph: 7.0, tds: 300, ec: 0.8 })
      );

      // Route soil
      handler(SOIL_WATER_TOPICS.SOIL_DATA, soilPayload);
      // Route water
      handler(SOIL_WATER_TOPICS.WATER_DATA, waterPayload);
      // Route unknown
      handler('irigasi/melon/faucet/command', Buffer.from('{}'));

      // Let async handler complete
      await new Promise((r) => setTimeout(r, 50));

      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledTimes(1);
      expect(mockTelemetryRepo.ingestWaterReading).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes and cleans up on stop()', async () => {
      await adapter.start();
      adapter.stop();
      // Calling stop again should be safe and idempotent
      adapter.stop();
    });
  });

  describe('Dynamic Device Resolution from MQTT Client Identity', () => {
    it('resolves SOIL_NODE using MQTT client_id from database registry', async () => {
      const resolved = await adapter.resolveSoilDeviceId('melon-esp32-tanah1');
      expect(mockDeviceRepo.getDeviceByClientId).toHaveBeenCalledWith('melon-esp32-tanah1');
      expect(resolved).toBe('melon-esp32-tanah1');
    });

    it('resolves WATER_QUALITY_NODE using MQTT client_id from database registry', async () => {
      const resolved = await adapter.resolveWaterDeviceId('melon-esp32-air1');
      expect(mockDeviceRepo.getDeviceByClientId).toHaveBeenCalledWith('melon-esp32-air1');
      expect(resolved).toBe('melon-esp32-air1');
    });

    it('returns null for unknown device client_id without fallback', async () => {
      const resolved = await adapter.resolveSoilDeviceId('unknown-device-123');
      expect(resolved).toBeNull();
    });

    it('supports future hardware replacement without code changes via database client_id registry', async () => {
      const replacementSoilDevice = {
        ...mockSoilDevice,
        id: 'soil-uuid-replaced',
        deviceId: 'soil-node-new-hardware-002',
        clientId: 'melon-esp32-tanah-v2',
      };
      (mockDeviceRepo.getDeviceByClientId as any).mockResolvedValueOnce(replacementSoilDevice);

      adapter.clearDeviceCache();
      const resolved = await adapter.resolveSoilDeviceId('melon-esp32-tanah-v2');
      expect(mockDeviceRepo.getDeviceByClientId).toHaveBeenCalledWith('melon-esp32-tanah-v2');
      expect(resolved).toBe('soil-node-new-hardware-002');
    });

    it('uses in-memory resolution cache to avoid redundant database lookups within TTL', async () => {
      adapter.clearDeviceCache();
      const first = await adapter.resolveSoilDeviceId('melon-esp32-tanah1');
      const second = await adapter.resolveSoilDeviceId('melon-esp32-tanah1');

      expect(first).toBe('melon-esp32-tanah1');
      expect(second).toBe('melon-esp32-tanah1');
      // Should only query database once due to cache
      expect(mockDeviceRepo.getDeviceByClientId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Outbound AI Recommendation Publishing (TASK-0413 Phase C)', () => {
    const mockSoilPrediction = {
      id: 'pred-soil-uuid-111',
      deviceId: 'melon002',
      predictedClass: 'optimal',
      confidence: 0.92,
      summary: 'Kondisi tanah optimal. Pertahankan pemupukan.',
      actions: { module: 'soil' },
      farmerAction: ['Pertahankan kelembapan'],
      issues: [],
      modelVersion: 'v1.0.0',
      createdAt: new Date().toISOString(),
    };

    const mockWaterPrediction = {
      id: 'pred-water-uuid-222',
      deviceId: 'water001',
      predictedClass: 'warning',
      confidence: 0.85,
      summary: 'Ditemukan masalah keasaman air.',
      actions: { module: 'water' },
      farmerAction: ['Netralkan pH larutan'],
      issues: [
        { parameter: 'pH air', value: 5.2, problem: 'Terlalu asam', impact: 'Nutrisi terhambat' },
      ],
      modelVersion: 'v1.0.0',
      createdAt: new Date().toISOString(),
    };

    let mockPredictionClient: any;

    beforeEach(() => {
      mockPredictionClient = {
        isConfigured: vi.fn().mockReturnValue(true),
        getLatestSoilPrediction: vi.fn().mockResolvedValue(mockSoilPrediction),
        getLatestWaterPrediction: vi.fn().mockResolvedValue(mockWaterPrediction),
      };
      adapter.setPredictionClient(mockPredictionClient);
      adapter.clearPublishedHistory();
    });

    it('successfully fetches prediction and publishes outbound recommendation for soil telemetry with QoS 1 and retain false', async () => {
      const payload = JSON.stringify({
        clientId: 'melon-esp32-tanah1',
        n: 45,
        p: 25,
        k: 80,
        temp: 26,
        hum: 70,
        ph: 6.5,
        ec: 1.5,
      });

      const result = await adapter.handleInboundSoilData(payload);
      expect(result.success).toBe(true);

      // Allow async background dispatch promise to resolve
      await new Promise((r) => setTimeout(r, 20));

      // Verify dynamic database mapping lookup
      expect(mockDeviceRepo.getActiveExternalDeviceId).toHaveBeenCalledWith(
        mockSoilDevice.id,
        'SOIL',
        'EXTERNAL_ML'
      );

      // Verify prediction client queried with resolved externalDeviceId
      expect(mockPredictionClient.getLatestSoilPrediction).toHaveBeenCalledWith('melon002', {
        forceRefresh: true,
      });

      // Verify MQTT publish to topic with QoS 1 and retain false
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        SOIL_WATER_TOPICS.SOIL_RECOMMENDATION,
        expect.any(String),
        1,
        false
      );

      // Verify outbound payload content conforms to OutboundRecommendationPayload schema
      const publishedJson = JSON.parse(mockMqttClient.publish.mock.calls[0][1]);
      expect(publishedJson.domain).toBe('SOIL');
      expect(publishedJson.deviceId).toBe('melon-esp32-tanah1'); // canonical Melon deviceId
      expect(publishedJson.clientId).toBe('melon-esp32-tanah1');
      expect(publishedJson.predictionId).toBe('pred-soil-uuid-111');
      expect(publishedJson.messageId).toBe('rec-soil-pred-soil-uuid-111');
      expect(publishedJson.predictedClass).toBe('optimal');
      expect(publishedJson.confidence).toBe(0.92);
      expect(publishedJson.summary).toContain('Kondisi tanah');
    });

    it('successfully fetches prediction and publishes outbound recommendation for water quality telemetry with QoS 1 and retain false', async () => {
      const payload = JSON.stringify({
        clientId: 'melon-esp32-air1',
        ph: 5.2,
        tds: 800,
        ec: 1.6,
      });

      const result = await adapter.handleInboundWaterData(payload);
      expect(result.success).toBe(true);

      // Allow async background dispatch promise to resolve
      await new Promise((r) => setTimeout(r, 20));

      expect(mockDeviceRepo.getActiveExternalDeviceId).toHaveBeenCalledWith(
        mockWaterDevice.id,
        'WATER',
        'EXTERNAL_ML'
      );

      expect(mockPredictionClient.getLatestWaterPrediction).toHaveBeenCalledWith('water001', {
        forceRefresh: true,
      });

      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        SOIL_WATER_TOPICS.WATER_RECOMMENDATION,
        expect.any(String),
        1,
        false
      );

      const publishedJson = JSON.parse(mockMqttClient.publish.mock.calls[0][1]);
      expect(publishedJson.domain).toBe('WATER');
      expect(publishedJson.deviceId).toBe('melon-esp32-air1');
      expect(publishedJson.predictionId).toBe('pred-water-uuid-222');
      expect(publishedJson.messageId).toBe('rec-water-pred-water-uuid-222');
      expect(publishedJson.predictedClass).toBe('warning');
      expect(publishedJson.issues).toHaveLength(1);
    });

    it('skips prediction query and publish when device lacks an active external mapping (missing mapping)', async () => {
      mockDeviceRepo.getActiveExternalDeviceId.mockResolvedValueOnce(null);

      const dispatchResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });

      expect(dispatchResult.published).toBe(false);
      expect(dispatchResult.reason).toBe('NO_ACTIVE_EXTERNAL_MAPPING');
      expect(mockPredictionClient.getLatestSoilPrediction).not.toHaveBeenCalled();
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
    });

    it('skips publish when external prediction is unavailable (null)', async () => {
      mockPredictionClient.getLatestSoilPrediction.mockResolvedValueOnce(null);

      const dispatchResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });

      expect(dispatchResult.published).toBe(false);
      expect(dispatchResult.reason).toBe('PREDICTION_UNAVAILABLE');
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
    });

    it('skips publish when external prediction is stale (older than max staleness window)', async () => {
      const stalePrediction = {
        ...mockSoilPrediction,
        createdAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago (> 300s window)
      };
      mockPredictionClient.getLatestSoilPrediction.mockResolvedValueOnce(stalePrediction);

      const dispatchResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });

      expect(dispatchResult.published).toBe(false);
      expect(dispatchResult.reason).toBe('PREDICTION_STALE');
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
    });

    it('prevents republishing the same prediction ID (duplicate prediction suppression)', async () => {
      // First publish
      const firstResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });
      expect(firstResult.published).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledTimes(1);

      // Second dispatch with same prediction ID
      const secondResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });
      expect(secondResult.published).toBe(false);
      expect(secondResult.reason).toBe('DUPLICATE_PREDICTION');
      // No second MQTT publish
      expect(mockMqttClient.publish).toHaveBeenCalledTimes(1);

      // Third dispatch with a new prediction ID should publish
      const newSoilPrediction = {
        ...mockSoilPrediction,
        id: 'pred-soil-uuid-999',
        createdAt: new Date().toISOString(),
      };
      mockPredictionClient.getLatestSoilPrediction.mockResolvedValueOnce(newSoilPrediction);

      const thirdResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });
      expect(thirdResult.published).toBe(true);
      expect(thirdResult.predictionId).toBe('pred-soil-uuid-999');
      expect(mockMqttClient.publish).toHaveBeenCalledTimes(2);
    });

    it('enforces strict MQTT topic, QoS 1, retain: false, and stable prediction/message ID for subscriber idempotency', async () => {
      const dispatchResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });

      expect(dispatchResult.published).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        SOIL_WATER_TOPICS.SOIL_RECOMMENDATION,
        expect.any(String),
        1,
        false
      );

      const payload = JSON.parse(mockMqttClient.publish.mock.calls[0][1]);
      // Verify stable identifiers
      expect(payload.predictionId).toBe('pred-soil-uuid-111');
      expect(payload.messageId).toBe('rec-soil-pred-soil-uuid-111');
      expect(payload.deviceId).toBe('melon-esp32-tanah1'); // canonical Melon deviceId
      expect(payload.domain).toBe('SOIL');

      // Verify zero leakage of credentials, URLs, or internal query parameters
      expect(payload).not.toHaveProperty('supabaseUrl');
      expect(payload).not.toHaveProperty('supabaseKey');
      expect(payload).not.toHaveProperty('apiKey');
      expect(payload).not.toHaveProperty('rawRecommendation');
    });

    it('fails safely without throwing when external ML client times out or throws error', async () => {
      mockPredictionClient.getLatestSoilPrediction.mockRejectedValueOnce(
        new Error('ETIMEDOUT: Connection to external Supabase timed out')
      );

      const dispatchResult = await adapter.executeRecommendationDispatch({
        deviceDbId: mockSoilDevice.id,
        canonicalDeviceId: 'melon-esp32-tanah1',
        clientId: 'melon-esp32-tanah1',
        domain: 'SOIL',
      });

      expect(dispatchResult.published).toBe(false);
      expect(dispatchResult.reason).toBe('FETCH_ERROR');
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
    });

    it('ensures telemetry ingestion remains 100% successful even if recommendation dispatch fails', async () => {
      mockPredictionClient.getLatestSoilPrediction.mockRejectedValueOnce(
        new Error('External ML service is down (503 Service Unavailable)')
      );

      const payload = JSON.stringify({
        clientId: 'melon-esp32-tanah1',
        n: 45,
        p: 25,
        k: 80,
        temp: 26,
        hum: 70,
        ph: 6.5,
        ec: 1.5,
      });

      const ingestionResult = await adapter.handleInboundSoilData(payload);

      // Ingestion itself must succeed and record readingId
      expect(ingestionResult.success).toBe(true);
      expect(ingestionResult.readingId).toBe('soil-reading-uuid-123');
      expect(mockTelemetryRepo.ingestSoilReading).toHaveBeenCalledTimes(1);
    });

    it('preserves physical safety: recommendations are strictly advisory and never trigger faucet commands', async () => {
      const payload = JSON.stringify({
        clientId: 'melon-esp32-tanah1',
        n: 10,
        p: 10,
        k: 10,
        temp: 35,
        hum: 20,
        ph: 4.0,
        ec: 0.2,
        status: 'CRITICAL',
      });

      await adapter.handleInboundSoilData(payload);

      // Verify no publish to valve or automation actuation topics
      const publishedTopics = mockMqttClient.publish.mock.calls.map((c: any[]) => c[0]);
      expect(publishedTopics).not.toContain('irigasi/melon/kontrol/valve');
      expect(publishedTopics).not.toContain('irigasi/melon/setting/otomasi');
      expect(publishedTopics).not.toContain('agriculture/local/site-01/faucet/command');
    });
  });
});
