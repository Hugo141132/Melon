import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardwareMqttAdapter, hardwareMqttAdapter } from '../mqtt/hardware-adapter';
import { PERMANENT_HARDWARE_TOPICS } from '../mqtt/hardware-reconciliation';
import { GatewayEnv } from '../config/env';
import { FaucetCommandAction } from '@kebun-melon/contracts';

describe('HardwareMqttAdapter (TASK-0411 / Hardware Compatibility Layer)', () => {
  let adapter: HardwareMqttAdapter;
  let mockTelemetryProcessor: any;
  let mockInternalClient: any;
  let mockHardwareClient: any;
  let mockEnv: GatewayEnv;

  beforeEach(() => {
    mockTelemetryProcessor = {
      processTelemetryMessage: vi.fn().mockResolvedValue({
        success: true,
        readingId: 'reading-uuid-hw-001',
        isDuplicate: false,
      }),
    };

    mockInternalClient = {
      isConnected: vi.fn().mockReturnValue(true),
      subscribe: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn().mockReturnValue(vi.fn()),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    mockHardwareClient = {
      isConnected: vi.fn().mockReturnValue(true),
      subscribe: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn().mockReturnValue(vi.fn()),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    mockEnv = {
      NODE_ENV: 'staging',
      APP_ENV: 'staging',
      PORT: 3001,
      HOST: '0.0.0.0',
      MQTT_BROKER_URL: 'mqtt://localhost:1883',
      MQTT_GATEWAY_CLIENT_ID: 'gateway-test',
      MQTT_GATEWAY_USERNAME: 'gateway-user',
      MQTT_GATEWAY_PASSWORD: 'gateway-password',
      ENABLE_FAUCET_CONTROL: false,
      HARDWARE_ADAPTER_ENABLED: true,
      HARDWARE_TARGET_DEVICE_ID: 'water-tank-node-zi37gz',
    } as GatewayEnv;

    adapter = new HardwareMqttAdapter({
      env: mockEnv,
      mqttClient: mockInternalClient,
      hardwareMqttClient: mockHardwareClient,
      telemetryProcessor: mockTelemetryProcessor,
      targetDeviceId: 'water-tank-node-zi37gz',
      targetSiteId: 'site-01',
    });
  });

  describe('1. Raw Payload Normalization (irigasi/melon/sensor/volume)', () => {
    it('normalizes raw numeric string into float volume', () => {
      expect(adapter.normalizeRawVolume('125.75')).toBe(125.75);
      expect(adapter.normalizeRawVolume('0')).toBe(0);
      expect(adapter.normalizeRawVolume('2200')).toBe(2200);
      expect(adapter.normalizeRawVolume(Buffer.from('85.4'))).toBe(85.4);
    });

    it('normalizes raw JSON payload with volume field', () => {
      const jsonBuffer = Buffer.from(JSON.stringify({ volume: 150.2 }));
      expect(adapter.normalizeRawVolume(jsonBuffer)).toBe(150.2);
    });

    it('normalizes raw JSON payload with tankVolume field', () => {
      const jsonBuffer = Buffer.from(JSON.stringify({ tankVolume: 99.9 }));
      expect(adapter.normalizeRawVolume(jsonBuffer)).toBe(99.9);
    });

    it('normalizes raw JSON payload with liter field', () => {
      const jsonBuffer = Buffer.from(JSON.stringify({ liter: '45.0' }));
      expect(adapter.normalizeRawVolume(jsonBuffer)).toBe(45.0);
    });

    it('rejects negative volume values fail-closed', () => {
      expect(adapter.normalizeRawVolume('-10.5')).toBeNull();
      expect(adapter.normalizeRawVolume(JSON.stringify({ volume: -5 }))).toBeNull();
    });

    it('rejects non-numeric string and malformed JSON fail-closed', () => {
      expect(adapter.normalizeRawVolume('not-a-number')).toBeNull();
      expect(adapter.normalizeRawVolume('')).toBeNull();
      expect(adapter.normalizeRawVolume('   ')).toBeNull();
      expect(adapter.normalizeRawVolume(JSON.stringify({ status: 'OK' }))).toBeNull();
    });
  });

  describe('2. Inbound Telemetry Ingestion & Routing', () => {
    it('successfully processes hardware volume message and invokes telemetryProcessor with canonical contract', async () => {
      const rawPayload = '175.5';
      const result = await adapter.handleInboundHardwareVolume(rawPayload);

      expect(result.success).toBe(true);
      expect(result.readingId).toBe('reading-uuid-hw-001');
      expect(result.normalizedVolume).toBe(175.5);

      expect(mockTelemetryProcessor.processTelemetryMessage).toHaveBeenCalledTimes(1);
      const [calledTopic, calledPayloadBuf] =
        mockTelemetryProcessor.processTelemetryMessage.mock.calls[0];

      expect(calledTopic).toBe(
        'agriculture/staging/site-01/water-tank-node-zi37gz/telemetry/reservoir'
      );

      const parsedPayload = JSON.parse(calledPayloadBuf.toString('utf-8'));
      expect(parsedPayload.schemaVersion).toBe('1.0');
      expect(parsedPayload.deviceId).toBe('water-tank-node-zi37gz');
      expect(parsedPayload.siteId).toBe('site-01');
      expect(parsedPayload.data.tankVolume).toBe(175.5);
      expect(parsedPayload.data.status).toBe('NORMAL');
      expect(parsedPayload.messageId).toMatch(/^hw-vol-/);
      // Verify DEC-DEV-032: intermediate republish to internal MQTT is removed
      expect(mockInternalClient.publish).not.toHaveBeenCalled();
    });

    it('rejects invalid payload without calling telemetryProcessor', async () => {
      const result = await adapter.handleInboundHardwareVolume('invalid-data');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_VOLUME_PAYLOAD');
      expect(mockTelemetryProcessor.processTelemetryMessage).not.toHaveBeenCalled();
    });

    it('uses configured target deviceId if customized', async () => {
      adapter.setTargetDeviceId('custom-water-tank-99');
      const result = await adapter.handleInboundHardwareVolume('500');

      expect(result.success).toBe(true);
      const [calledTopic, calledPayloadBuf] =
        mockTelemetryProcessor.processTelemetryMessage.mock.calls[0];
      expect(calledTopic).toBe(
        'agriculture/staging/site-01/custom-water-tank-99/telemetry/reservoir'
      );

      const parsedPayload = JSON.parse(calledPayloadBuf.toString('utf-8'));
      expect(parsedPayload.deviceId).toBe('custom-water-tank-99');
    });
  });

  describe('3. Outbound Faucet Command Translation', () => {
    it('translates manual OPEN action to "ON" string on irigasi/melon/kontrol/valve', () => {
      const translated = adapter.translateCommand({ action: FaucetCommandAction.OPEN });
      expect(translated).not.toBeNull();
      expect(translated?.topic).toBe(PERMANENT_HARDWARE_TOPICS.topicValve);
      expect(translated?.payload).toBe('ON');
      expect(translated?.qos).toBe(1);
      expect(translated?.retain).toBe(false);
    });

    it('translates manual CLOSE action to "OFF" string on irigasi/melon/kontrol/valve', () => {
      const translated = adapter.translateCommand({ action: FaucetCommandAction.CLOSE });
      expect(translated).not.toBeNull();
      expect(translated?.topic).toBe(PERMANENT_HARDWARE_TOPICS.topicValve);
      expect(translated?.payload).toBe('OFF');
      expect(translated?.qos).toBe(1);
      expect(translated?.retain).toBe(false);
    });

    it('translates DISPENSE action to AUTO mode with target_liter on irigasi/melon/setting/otomasi', () => {
      const translated = adapter.translateCommand({
        action: FaucetCommandAction.DISPENSE,
        targetVolumeMl: 1500,
        phase: 'PHASE_3',
        plantCount: 1,
      });
      expect(translated).not.toBeNull();
      expect(translated?.topic).toBe(PERMANENT_HARDWARE_TOPICS.topicOtomasi);
      expect(translated?.qos).toBe(1);
      expect(translated?.retain).toBe(false);

      const parsedJson = JSON.parse(translated!.payload);
      expect(parsedJson).toEqual({
        mode: 'AUTO',
        target_liter: 1.5,
      });
    });

    it('correctly calculates multi-plant dispense target_liter in Liters', () => {
      // 1000 mL * 3 plants = 3000 mL = 3.0 L
      const translated = adapter.translateCommand({
        action: FaucetCommandAction.DISPENSE,
        targetVolumeMl: 3000,
        phase: 'PHASE_2',
        plantCount: 3,
      });

      const parsedJson = JSON.parse(translated!.payload);
      expect(parsedJson.target_liter).toBe(3);
    });

    it('returns null for unknown command action', () => {
      const translated = adapter.translateCommand({ action: 'UNKNOWN_ACTION' as any });
      expect(translated).toBeNull();
    });
  });

  describe('4. Faucet Safety Guard (ENABLE_FAUCET_CONTROL)', () => {
    it('rejects dispatching hardware commands when ENABLE_FAUCET_CONTROL is false', async () => {
      mockEnv.ENABLE_FAUCET_CONTROL = false;
      const result = await adapter.dispatchHardwareCommand({
        action: FaucetCommandAction.OPEN,
        deviceId: 'water-tank-node-zi37gz',
      });

      expect(result.published).toBe(false);
      expect(result.reason).toBe('ENABLE_FAUCET_CONTROL_DISABLED');
      expect(mockHardwareClient.publish).not.toHaveBeenCalled();
    });

    it('allows dispatching hardware commands when ENABLE_FAUCET_CONTROL is true', async () => {
      mockEnv.ENABLE_FAUCET_CONTROL = true;
      const result = await adapter.dispatchHardwareCommand({
        action: FaucetCommandAction.OPEN,
        deviceId: 'water-tank-node-zi37gz',
      });

      expect(result.published).toBe(true);
      expect(mockHardwareClient.publish).toHaveBeenCalledWith(
        PERMANENT_HARDWARE_TOPICS.topicValve,
        Buffer.from('ON'),
        1,
        false
      );
    });

    it('dispatches manual CLOSE directly to irigasi/melon/kontrol/valve with OFF when ENABLE_FAUCET_CONTROL is true', async () => {
      mockEnv.ENABLE_FAUCET_CONTROL = true;
      const result = await adapter.dispatchHardwareCommand({
        action: FaucetCommandAction.CLOSE,
        deviceId: 'water-tank-node-zi37gz',
      });

      expect(result.published).toBe(true);
      expect(mockHardwareClient.publish).toHaveBeenCalledWith(
        PERMANENT_HARDWARE_TOPICS.topicValve,
        Buffer.from('OFF'),
        1,
        false
      );
    });

    it('dispatches DISPENSE directly to irigasi/melon/setting/otomasi with target_liter when ENABLE_FAUCET_CONTROL is true', async () => {
      mockEnv.ENABLE_FAUCET_CONTROL = true;
      const result = await adapter.dispatchHardwareCommand({
        action: FaucetCommandAction.DISPENSE,
        targetVolumeMl: 1500,
        phase: 'PHASE_3',
        plantCount: 1,
        deviceId: 'water-tank-node-zi37gz',
      });

      expect(result.published).toBe(true);
      expect(mockHardwareClient.publish).toHaveBeenCalledWith(
        PERMANENT_HARDWARE_TOPICS.topicOtomasi,
        Buffer.from(JSON.stringify({ mode: 'AUTO', target_liter: 1.5 })),
        1,
        false
      );
    });
  });

  describe('5. Lifecycle & Subscription Handling', () => {
    it('subscribes to permanent hardware volume topic when started', async () => {
      await adapter.start();
      expect(mockHardwareClient.subscribe).toHaveBeenCalledWith(
        PERMANENT_HARDWARE_TOPICS.topicVolume
      );
    });

    it('does not subscribe when HARDWARE_ADAPTER_ENABLED is false', async () => {
      mockEnv.HARDWARE_ADAPTER_ENABLED = false;
      await adapter.start();
      expect(mockHardwareClient.subscribe).not.toHaveBeenCalled();
    });

    it('cleans up subscription on stop', async () => {
      const mockUnsub = vi.fn();
      mockHardwareClient.onMessage.mockReturnValue(mockUnsub);

      await adapter.start();
      adapter.stop();

      expect(mockUnsub).toHaveBeenCalled();
    });
  });

  describe('6. Single WATER_TANK_NODE Identity Resolution (DEC-DEV-032)', () => {
    it('resolves target deviceId directly from WATER_TANK_DEVICE_ID env variable', async () => {
      const customEnv = {
        ...mockEnv,
        WATER_TANK_DEVICE_ID: 'water-tank-env-999',
      } as GatewayEnv;

      const customAdapter = new HardwareMqttAdapter({
        env: customEnv,
        mqttClient: mockInternalClient,
        hardwareMqttClient: mockHardwareClient,
        telemetryProcessor: mockTelemetryProcessor,
      });

      const resolved = await customAdapter.resolveTargetDeviceId();
      expect(resolved).toBe('water-tank-env-999');
      expect(customAdapter.getTargetDeviceId()).toBe('water-tank-env-999');
    });

    it('falls back to database lookup when environment variables are omitted', async () => {
      const envWithoutIds = {
        ...mockEnv,
        WATER_TANK_DEVICE_ID: undefined,
        HARDWARE_TARGET_DEVICE_ID: undefined,
      } as unknown as GatewayEnv;

      const mockDeviceRepo = {
        getDevices: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'uuid-tank-db-1',
              deviceId: 'water-tank-db-discovered',
              deviceType: 'WATER_TANK_NODE',
              accountStatus: 'ACTIVE',
              siteId: 'site-db-01',
            },
          ],
          pagination: { page: 1, pageSize: 5, totalItems: 1, totalPages: 1 },
        }),
      };

      const fallbackAdapter = new HardwareMqttAdapter({
        env: envWithoutIds,
        mqttClient: mockInternalClient,
        hardwareMqttClient: mockHardwareClient,
        telemetryProcessor: mockTelemetryProcessor,
        deviceRepo: mockDeviceRepo as any,
      });

      const resolved = await fallbackAdapter.resolveTargetDeviceId();
      expect(resolved).toBe('water-tank-db-discovered');
      expect(fallbackAdapter.getTargetDeviceId()).toBe('water-tank-db-discovered');
      expect(mockDeviceRepo.getDevices).toHaveBeenCalledWith({
        deviceType: 'WATER_TANK_NODE',
        page: 1,
        pageSize: 5,
        sort: 'createdAt:desc',
      });
    });

    it('resolves active WATER_TANK_NODE from database even when HARDWARE_TARGET_DEVICE_ID default is present', async () => {
      const envWithDefaultHardwareId = {
        ...mockEnv,
        WATER_TANK_DEVICE_ID: undefined,
        HARDWARE_TARGET_DEVICE_ID: 'water-tank-node-zi37gz',
      } as unknown as GatewayEnv;

      const mockDeviceRepo = {
        getDevices: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'd1926a3e-1a79-447e-8167-3a2d39426508',
              deviceId: 'water-tank-uqiwue',
              siteId: 'd31b05fb-5cb9-4120-96d8-3c04dfff1c56',
              deviceType: 'WATER_TANK_NODE',
              accountStatus: 'ACTIVE',
            },
          ],
          total: 1,
        }),
      };

      const dbAdapter = new HardwareMqttAdapter({
        env: envWithDefaultHardwareId,
        mqttClient: mockInternalClient,
        hardwareMqttClient: mockHardwareClient,
        telemetryProcessor: mockTelemetryProcessor,
        deviceRepo: mockDeviceRepo as any,
      });

      const resolved = await dbAdapter.resolveTargetDeviceId();
      expect(resolved).toBe('water-tank-uqiwue');
      expect(dbAdapter.getTargetDeviceId()).toBe('water-tank-uqiwue');

      // Now verify handleInboundHardwareVolume uses resolved device and site
      const result = await dbAdapter.handleInboundHardwareVolume('165.5');
      expect(result.success).toBe(true);

      expect(mockTelemetryProcessor.processTelemetryMessage).toHaveBeenCalledTimes(1);
      const [calledTopic, calledPayloadBuf] =
        mockTelemetryProcessor.processTelemetryMessage.mock.calls[0];

      expect(calledTopic).toBe(
        'agriculture/staging/d31b05fb-5cb9-4120-96d8-3c04dfff1c56/water-tank-uqiwue/telemetry/reservoir'
      );

      const parsedPayload = JSON.parse(calledPayloadBuf.toString('utf-8'));
      expect(parsedPayload.deviceId).toBe('water-tank-uqiwue');
      expect(parsedPayload.siteId).toBe('d31b05fb-5cb9-4120-96d8-3c04dfff1c56');
      expect(parsedPayload.data.tankVolume).toBe(165.5);
    });
  });
});
