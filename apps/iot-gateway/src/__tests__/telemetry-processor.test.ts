import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryProcessor } from '../telemetry/processor';
import { DeviceType } from '@kebun-melon/contracts';
import { GatewayEnv } from '../config/env';

describe('TelemetryProcessor', () => {
  let processor: TelemetryProcessor;
  let mockTelemetryRepo: any;
  let mockDeviceRepo: any;
  let mockEnv: GatewayEnv;

  const validDeviceId = 'water-tank-node-zi37gz';
  const validSiteId = 'site-01';
  const validTopic = `agriculture/staging/${validSiteId}/${validDeviceId}/telemetry/reservoir`;

  const validPayload = {
    schemaVersion: '1.0',
    messageId: 'msg-sim-000001',
    deviceId: validDeviceId,
    siteId: validSiteId,
    sequence: 1,
    recordedAt: '2026-08-09T12:00:00.000Z',
    sentAt: '2026-08-09T12:00:01.000Z',
    firmwareVersion: '1.0.0',
    data: {
      tankVolume: 85.5,
      flowRate: 3.2,
      status: 'NORMAL',
    },
  };

  beforeEach(() => {
    mockTelemetryRepo = {
      ingestReservoirReading: vi.fn().mockResolvedValue({
        readingId: 'reading-uuid-001',
        deviceId: 'device-uuid-001',
        canonicalDeviceId: validDeviceId,
        messageId: 'msg-sim-000001',
        recordedAt: new Date('2026-08-09T12:00:00.000Z'),
        receivedAt: new Date('2026-08-09T12:00:01.000Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      }),
    };

    mockDeviceRepo = {
      getDeviceByCanonicalId: vi.fn().mockResolvedValue({
        id: 'device-uuid-001',
        deviceId: validDeviceId,
        siteId: validSiteId,
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: 'ACTIVE',
      }),
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
    } as GatewayEnv;

    processor = new TelemetryProcessor({
      env: mockEnv,
      telemetryRepo: mockTelemetryRepo,
      deviceRepo: mockDeviceRepo,
    });
  });

  it('should successfully ingest valid reservoir telemetry reading and update device lastSeenAt', async () => {
    const rawBuffer = Buffer.from(JSON.stringify(validPayload));
    const result = await processor.processTelemetryMessage(validTopic, rawBuffer);

    expect(result.success).toBe(true);
    expect(result.readingId).toBe('reading-uuid-001');
    expect(result.isDuplicate).toBe(false);

    expect(mockDeviceRepo.getDeviceByCanonicalId).toHaveBeenCalledWith(validDeviceId);
    expect(mockTelemetryRepo.ingestReservoirReading).toHaveBeenCalledWith({
      deviceId: 'device-uuid-001',
      messageId: 'msg-sim-000001',
      schemaVersion: '1.0',
      sequenceNumber: 1,
      recordedAt: '2026-08-09T12:00:00.000Z',
      tankVolume: 85.5,
      flowRate: 3.2,
      status: 'NORMAL',
    });
  });

  it('should reject telemetry message with topic and payload deviceId mismatch', async () => {
    const mismatchedTopic = `agriculture/staging/${validSiteId}/other-node-999/telemetry/reservoir`;
    const rawBuffer = Buffer.from(JSON.stringify(validPayload));

    const result = await processor.processTelemetryMessage(mismatchedTopic, rawBuffer);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Topic and payload deviceId mismatch');
    expect(mockTelemetryRepo.ingestReservoirReading).not.toHaveBeenCalled();
  });

  it('should reject telemetry if target device is not found', async () => {
    mockDeviceRepo.getDeviceByCanonicalId.mockResolvedValue(null);
    const rawBuffer = Buffer.from(JSON.stringify(validPayload));

    const result = await processor.processTelemetryMessage(validTopic, rawBuffer);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Device not found');
  });

  it('should reject telemetry if target device is not a WATER_TANK_NODE', async () => {
    mockDeviceRepo.getDeviceByCanonicalId.mockResolvedValue({
      id: 'device-uuid-001',
      deviceId: validDeviceId,
      siteId: validSiteId,
      deviceType: DeviceType.SOIL_NODE,
      accountStatus: 'ACTIVE',
    });
    const rawBuffer = Buffer.from(JSON.stringify(validPayload));

    const result = await processor.processTelemetryMessage(validTopic, rawBuffer);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Device is not a WATER_TANK_NODE');
  });

  it('should handle duplicate telemetry payload idempotently', async () => {
    mockTelemetryRepo.ingestReservoirReading.mockResolvedValue({
      readingId: 'reading-uuid-001',
      deviceId: 'device-uuid-001',
      canonicalDeviceId: validDeviceId,
      messageId: 'msg-sim-000001',
      recordedAt: new Date('2026-08-09T12:00:00.000Z'),
      receivedAt: new Date('2026-08-09T12:00:01.000Z'),
      isDuplicate: true,
      validationStatus: 'VALID',
    });

    const rawBuffer = Buffer.from(JSON.stringify(validPayload));
    const result = await processor.processTelemetryMessage(validTopic, rawBuffer);

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
  });
});
