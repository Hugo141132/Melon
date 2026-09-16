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
    } as GatewayEnv;

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
});
