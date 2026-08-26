import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceSimulator } from '../../../../scripts/device-simulator';
import { FAUCET_ACK_REASON_CODES } from '@kebun-melon/contracts';

describe('TASK-0408: DeviceSimulator Unit & Scenario Verification', () => {
  let simulator: DeviceSimulator;

  beforeEach(() => {
    simulator = new DeviceSimulator({
      environment: 'staging',
      siteId: 'site-test-01',
      soilDeviceId: 'soil-node-test-001',
      waterDeviceId: 'water-node-test-001',
      tankDeviceId: 'water-tank-node-test-001',
      apiBaseUrl: 'http://localhost:3000',
      brokerUrl: 'mqtt://localhost:1883',
      username: 'test_user',
      password: 'test_password',
    });

    vi.spyOn(simulator, 'connectMqtt').mockResolvedValue({
      publish: (_topic: string, _msg: string, _opts: unknown, cb: (err?: Error) => void) => {
        if (typeof cb === 'function') cb();
      },
      subscribe: (_topic: string, _opts: unknown, cb: (err?: Error) => void) => {
        if (typeof cb === 'function') cb();
      },
      end: (_force: boolean, cb: () => void) => {
        if (typeof cb === 'function') cb();
      },
      on: vi.fn(),
    } as unknown as import('mqtt').MqttClient);
  });

  describe('Domain Device ID Resolution & Incompatible Rejection (Defect 1)', () => {
    it('routes Soil Telemetry to SOIL_NODE device ID', () => {
      const payload = simulator.buildSoilTelemetryPayload({ nitrogen: 50.0 });
      expect(payload.deviceId).toBe('soil-node-test-001');
    });

    it('routes Water Quality Telemetry to WATER_QUALITY_NODE device ID', () => {
      const payload = simulator.buildWaterTelemetryPayload({ ph: 7.2 });
      expect(payload.deviceId).toBe('water-node-test-001');
    });

    it('routes Reservoir Telemetry to WATER_TANK_NODE device ID', () => {
      const payload = simulator.buildReservoirTelemetryPayload({ tankVolume: 80.0 });
      expect(payload.deviceId).toBe('water-tank-node-test-001');
    });

    it('rejects passing a WATER_TANK_NODE device ID to Soil Telemetry simulation', () => {
      expect(() => simulator.getSoilDeviceId('water-tank-node-zi37gz')).toThrowError(
        "[DeviceSimulator] Incompatible device ID 'water-tank-node-zi37gz' for Soil Telemetry simulation. Soil Telemetry requires a SOIL_NODE device."
      );
    });

    it('rejects passing a SOIL_NODE device ID to Water Quality Telemetry simulation', () => {
      expect(() => simulator.getWaterDeviceId('soil-node-001')).toThrowError(
        "[DeviceSimulator] Incompatible device ID 'soil-node-001' for Water Quality Telemetry simulation. Water Quality Telemetry requires a WATER_QUALITY_NODE device."
      );
    });

    it('rejects passing a WATER_QUALITY_NODE device ID to Reservoir/Faucet simulation', () => {
      expect(() => simulator.getTankDeviceId('water-node-001')).toThrowError(
        "[DeviceSimulator] Incompatible device ID 'water-node-001' for Reservoir/Faucet simulation. Reservoir/Faucet scenarios require a WATER_TANK_NODE device."
      );
    });

    it('throws clear configuration error when unconfigured SOIL_NODE device ID is requested', () => {
      const unconfigured = new DeviceSimulator({ soilDeviceId: '', deviceId: 'esp32-001' });
      expect(() => unconfigured.getSoilDeviceId()).toThrowError(
        '[DeviceSimulator] Missing registered SOIL_NODE device configuration.'
      );
    });

    it('throws clear configuration error when unconfigured WATER_QUALITY_NODE device ID is requested', () => {
      const unconfigured = new DeviceSimulator({ waterDeviceId: '', deviceId: 'esp32-001' });
      expect(() => unconfigured.getWaterDeviceId()).toThrowError(
        '[DeviceSimulator] Missing registered WATER_QUALITY_NODE device configuration.'
      );
    });

    it('throws clear configuration error when unconfigured WATER_TANK_NODE device ID is requested', () => {
      const unconfigured = new DeviceSimulator({ tankDeviceId: '', deviceId: '' });
      expect(() => unconfigured.getTankDeviceId()).toThrowError(
        '[DeviceSimulator] Missing registered WATER_TANK_NODE device configuration.'
      );
    });
  });

  describe('Contract Payload Generation', () => {
    it('generates canonical Soil Telemetry REST payload conforming to DEC-MON-086 (no BAT)', () => {
      const payload = simulator.buildSoilTelemetryPayload({ nitrogen: 50.0, ph: 6.8 });

      expect(payload.schemaVersion).toBe('1.0');
      expect(payload.deviceId).toBe('soil-node-test-001');
      expect(payload.siteId).toBe('site-test-01');
      expect(payload.messageId).toContain('msg-soil-');
      expect(payload.recordedAt).toBeDefined();
      expect(payload.data.nitrogen).toBe(50.0);
      expect(payload.data.ph).toBe(6.8);
      expect(payload.data.status).toBe('NORMAL');

      // Verify BAT parameter is completely removed (DEC-MON-086)
      expect((payload.data as Record<string, unknown>).battery).toBeUndefined();
      expect((payload.data as Record<string, unknown>).bat).toBeUndefined();
    });

    it('generates canonical Water Quality Telemetry REST payload conforming to DEC-MON-086 (no BAT, lat, long)', () => {
      const payload = simulator.buildWaterTelemetryPayload({ ph: 7.2, tds: 350 });

      expect(payload.schemaVersion).toBe('1.0');
      expect(payload.deviceId).toBe('water-node-test-001');
      expect(payload.data.ph).toBe(7.2);
      expect(payload.data.tds).toBe(350);
      expect(payload.data.ec).toBe(0.84);
      expect(payload.data.status).toBe('NORMAL');

      // Verify BAT, latitude, longitude parameters are omitted
      const dataObj = payload.data as Record<string, unknown>;
      expect(dataObj.battery).toBeUndefined();
      expect(dataObj.bat).toBeUndefined();
      expect(dataObj.latitude).toBeUndefined();
      expect(dataObj.longitude).toBeUndefined();
    });

    it('generates canonical Reservoir Telemetry MQTT payload', () => {
      const payload = simulator.buildReservoirTelemetryPayload({ tankVolume: 82.5, flowRate: 3.1 });

      expect(payload.schemaVersion).toBe('1.0');
      expect(payload.deviceId).toBe('water-tank-node-test-001');
      expect(payload.data.tankVolume).toBe(82.5);
      expect(payload.data.flowRate).toBe(3.1);
      expect(payload.data.status).toBe('NORMAL');
    });
  });

  describe('Faucet Command Response Generation', () => {
    it('creates valid ACK payload for accepted command', async () => {
      const publishSpy = vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.sendFaucetAck('cmd-uuid-101', true);

      expect(res.topic).toBe(
        'agriculture/staging/site-test-01/water-tank-node-test-001/ack/faucet'
      );
      expect(res.payload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-101',
        deviceId: 'water-tank-node-test-001',
        data: {
          status: 'ACKNOWLEDGED',
          accepted: true,
        },
      });
      expect(publishSpy).toHaveBeenCalledOnce();
    });

    it('creates valid REJECTED ACK payload with canonical reason code', async () => {
      const publishSpy = vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.sendFaucetAck('cmd-uuid-102', false, 'DEVICE_BUSY');

      expect(res.payload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-102',
        deviceId: 'water-tank-node-test-001',
        data: {
          status: 'REJECTED',
          accepted: false,
          reasonCode: 'DEVICE_BUSY',
        },
      });
      expect(FAUCET_ACK_REASON_CODES).toContain('DEVICE_BUSY');
      expect(publishSpy).toHaveBeenCalledOnce();
    });

    it('creates valid IN_PROGRESS event payload', async () => {
      const publishSpy = vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.sendFaucetProgress('cmd-uuid-103', 500);

      expect(res.topic).toBe(
        'agriculture/staging/site-test-01/water-tank-node-test-001/event/faucet'
      );
      expect(res.payload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-103',
        data: {
          status: 'IN_PROGRESS',
          actualVolumeMl: 500,
        },
      });
      expect(publishSpy).toHaveBeenCalledOnce();
    });

    it('creates valid COMPLETED event payload', async () => {
      const publishSpy = vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.sendFaucetCompletion('cmd-uuid-104', 1000, 1005);

      expect(res.topic).toBe(
        'agriculture/staging/site-test-01/water-tank-node-test-001/event/faucet'
      );
      expect(res.payload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-104',
        data: {
          status: 'COMPLETED',
          targetVolumeMl: 1000,
          actualVolumeMl: 1005,
        },
      });
      expect(publishSpy).toHaveBeenCalledOnce();
    });

    it('creates valid FAILED event payload with reason code', async () => {
      const publishSpy = vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.sendFaucetFailure('cmd-uuid-105', 'FLOW_NOT_DETECTED');

      expect(res.topic).toBe(
        'agriculture/staging/site-test-01/water-tank-node-test-001/event/faucet'
      );
      expect(res.payload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-105',
        data: {
          status: 'FAILED',
          reasonCode: 'FLOW_NOT_DETECTED',
        },
      });
      expect(publishSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Scenario Execution Runners', () => {
    it('executes full Faucet Dispense Lifecycle scenario', async () => {
      vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.runFaucetDispenseLifecycleScenario('cmd-scenario-001', 1000);

      expect(res.simulated).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.scenario).toBe('faucet-dispense-lifecycle');
    });

    it('executes Faucet Command Rejection scenario', async () => {
      vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.runFaucetRejectionScenario(
        'cmd-scenario-002',
        'CONTROL_DISABLED'
      );

      expect(res.simulated).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.scenario).toBe('faucet-rejection');
    });

    it('executes Faucet Command Failure scenario', async () => {
      vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.runFaucetFailureScenario('cmd-scenario-003', 'FLOW_NOT_DETECTED');

      expect(res.simulated).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.scenario).toBe('faucet-failure');
    });

    it('executes Out-of-Order payload scenario', async () => {
      vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.runOutOfOrderScenario('reservoir');

      expect(res.simulated).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.scenario).toBe('out-of-order');
    });

    it('executes Invalid Payload scenario (OVERSIZED_PAYLOAD)', async () => {
      vi.spyOn(simulator, 'publishRawMqtt').mockResolvedValue(undefined);

      const res = await simulator.runInvalidPayloadScenario('reservoir', 'OVERSIZED_PAYLOAD');

      expect(res.simulated).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.scenario).toBe('invalid-payload-oversized_payload');
    });

    it('explicitly reports Heartbeat scenario as BLOCKED due to TBD thresholds (TASK-0407)', () => {
      const res = simulator.runHeartbeatScenario();

      expect(res.simulated).toBe(false);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('TASK-0407');
    });

    it('explicitly reports Timeout scenario as BLOCKED due to TBD durations (TASK-0809)', () => {
      const res = simulator.runTimeoutScenario();

      expect(res.simulated).toBe(false);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toContain('TASK-0809');
    });
  });

  describe('REST Telemetry Response Handling Safety (Defect 2)', () => {
    it('sends Soil Telemetry over HTTP REST API and handles HTML/non-JSON response safely without body unusable error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('<html>Internal Server Error</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      const res = await simulator.sendSoilTelemetry({ nitrogen: 48.0 });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/devices/soil-node-test-001/telemetry/soil',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-test-001',
          },
        })
      );
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
      expect(res.body).toBe('<html>Internal Server Error</html>');
      expect(res.payload.deviceId).toBe('soil-node-test-001');

      fetchSpy.mockRestore();
    });

    it('sends Water Quality Telemetry over HTTP REST API and handles JSON success response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ readingId: 'read-water-001', isDuplicate: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await simulator.sendWaterTelemetry({ ph: 7.4 });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/devices/water-node-test-001/telemetry/water',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'water-node-test-001',
          },
        })
      );
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.payload.data.ph).toBe(7.4);
      expect(res.payload.deviceId).toBe('water-node-test-001');

      fetchSpy.mockRestore();
    });
  });
});
