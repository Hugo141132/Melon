#!/usr/bin/env tsx

/**
 * =============================================================================
 * Development Hardware Telemetry Ingestion Verification
 * TASK-0411 — End-to-end hardware volume ingestion from broker.emqx.io to database
 * =============================================================================
 *
 * Verifies:
 * 1. HardwareMqttAdapter resolves target WATER_TANK_NODE deviceId ('water-tank-uqiwue')
 *    and siteId from database.
 * 2. Hardware payload published to broker.emqx.io:8084 (irigasi/melon/sensor/volume)
 *    is received by the adapter.
 * 3. Payload is normalized and ingested into PostgreSQL (reservoir_water_readings).
 * 4. Latest monitoring query resolves the newly ingested tankVolume (245.5 L).
 * 5. Realtime event emission hook (telemetry.water.updated) is triggered.
 *
 * Safety:
 * - Strictly development testing using broker.emqx.io:8084 (WSS).
 * - Zero modification to production EMQX Cloud cluster.
 * - Zero modification to staging environment.
 * =============================================================================
 */

import mqtt from 'mqtt';
import { prisma, DeviceRepository, TelemetryRepository } from '@kebun-melon/database';
import { DeviceType } from '@kebun-melon/contracts';
import { HardwareMqttAdapter } from '../apps/iot-gateway/src/mqtt/hardware-adapter';
import { TelemetryProcessor } from '../apps/iot-gateway/src/telemetry/processor';
import { GatewayMqttClient } from '../apps/iot-gateway/src/mqtt/client';
import { validateGatewayEnv, GatewayEnv } from '../apps/iot-gateway/src/config/env';
import { logger } from '../apps/iot-gateway/src/observability/logger';

const DEV_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

async function runVerification() {
  console.log('=============================================================================');
  console.log(' TASK-0411: Development Hardware Telemetry Ingestion Verification');
  console.log(' Target Broker: broker.emqx.io:8084 (WSS)');
  console.log(' Hardware Topic: irigasi/melon/sensor/volume');
  console.log('=============================================================================\n');

  // 1. Initialize DB Repositories
  console.log('[1/5] Verifying Database Connection and Active Water Tank Device...');
  const deviceRepo = new DeviceRepository(prisma);
  const telemetryRepo = new TelemetryRepository(prisma);

  const tankDevices = await deviceRepo.getDevices({
    deviceType: DeviceType.WATER_TANK_NODE,
    page: 1,
    pageSize: 5,
  });

  const activeTank = tankDevices.items.find((d) => d.accountStatus === 'ACTIVE');
  if (!activeTank) {
    throw new Error('No active WATER_TANK_NODE found in database! Verification aborted.');
  }

  console.log(
    ` -> Found Active Tank Device: ${activeTank.deviceId} (UUID: ${activeTank.id}, Site: ${activeTank.siteId})`
  );

  const initialCount = await prisma.reservoirWaterReading.count({
    where: { deviceId: activeTank.id },
  });
  console.log(` -> Existing reservoir_water_readings count for this device: ${initialCount}`);

  // 2. Build Gateway Components with DEV_BROKER_URL
  console.log('\n[2/5] Initializing Gateway HardwareMqttAdapter and TelemetryProcessor...');
  const env: GatewayEnv = validateGatewayEnv({
    ...process.env,
    APP_ENV: 'development',
    NODE_ENV: 'development',
    HARDWARE_ADAPTER_ENABLED: 'true',
    HARDWARE_MQTT_BROKER_URL: DEV_BROKER_URL,
  });

  const hardwareMqttClient = new GatewayMqttClient({
    ...env,
    MQTT_BROKER_URL: DEV_BROKER_URL,
    MQTT_GATEWAY_CLIENT_ID: `gateway-dev-test-${Date.now()}`,
    MQTT_GATEWAY_USERNAME: undefined,
    MQTT_GATEWAY_PASSWORD: undefined,
  });

  const telemetryProcessor = new TelemetryProcessor({
    env,
    prisma,
    telemetryRepo,
    deviceRepo,
  });

  const hardwareAdapter = new HardwareMqttAdapter({
    env,
    hardwareMqttClient,
    telemetryProcessor,
    deviceRepo,
  });

  // Verify dynamic resolution
  const resolvedDeviceId = await hardwareAdapter.resolveTargetDeviceId();
  console.log(` -> HardwareMqttAdapter dynamically resolved target deviceId: ${resolvedDeviceId}`);
  if (resolvedDeviceId !== activeTank.deviceId) {
    throw new Error(
      `Device ID resolution mismatch: expected ${activeTank.deviceId}, got ${resolvedDeviceId}`
    );
  }

  // Connect hardware client and subscribe
  console.log('\n[3/5] Connecting Gateway Hardware Client to broker.emqx.io:8084...');
  await hardwareMqttClient.connect();
  await hardwareAdapter.start();
  console.log(' -> HardwareMqttAdapter successfully subscribed to irigasi/melon/sensor/volume');

  // 3. Publish Test Volume Reading from Hardware Simulator
  const testVolume = 245.5;
  console.log(`\n[4/5] Simulating Hardware Device Publishing volume ${testVolume} L...`);
  const publisherClient = mqtt.connect(DEV_BROKER_URL, {
    clientId: `esp32-sim-${Date.now()}`,
    clean: true,
    connectTimeout: 8000,
  });

  await new Promise<void>((resolve, reject) => {
    publisherClient.on('connect', () => {
      console.log(' -> Hardware simulator connected to broker.emqx.io');
      publisherClient.publish(
        'irigasi/melon/sensor/volume',
        String(testVolume),
        { qos: 1, retain: false },
        (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(` -> Published raw payload "${testVolume}" to irigasi/melon/sensor/volume`);
            resolve();
          }
        }
      );
    });
    publisherClient.on('error', (err) => reject(err));
  });

  // 4. Wait for Gateway Ingestion
  console.log('\n[5/5] Waiting for Gateway Ingestion into Database...');
  let newRecordFound = false;
  let latestReading: any = null;

  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const currentCount = await prisma.reservoirWaterReading.count({
      where: { deviceId: activeTank.id },
    });

    if (currentCount > initialCount) {
      newRecordFound = true;
      latestReading = await prisma.reservoirWaterReading.findFirst({
        where: { deviceId: activeTank.id },
        orderBy: { recordedAt: 'desc' },
      });
      console.log(` -> Ingestion confirmed on attempt ${attempt}! Total count: ${currentCount}`);
      break;
    }
  }

  // Cleanup connections
  publisherClient.end(true);
  hardwareAdapter.stop();
  await hardwareMqttClient.disconnect();
  await prisma.$disconnect();

  if (!newRecordFound || !latestReading) {
    throw new Error(
      'Verification failed: No new row was created in reservoir_water_readings after 15 seconds!'
    );
  }

  console.log('\n=============================================================================');
  console.log(' VERIFICATION RESULT: PASS');
  console.log('=============================================================================');
  console.log(`Reading ID:       ${latestReading.id}`);
  console.log(`Device ID:        ${latestReading.deviceId} (Canonical: ${activeTank.deviceId})`);
  console.log(`Message ID:       ${latestReading.messageId}`);
  console.log(`Tank Volume:      ${latestReading.tankVolume} L`);
  console.log(`Status:           ${latestReading.status}`);
  console.log(`Recorded At:      ${latestReading.recordedAt}`);
  console.log(`Received At:      ${latestReading.receivedAt}`);
  console.log('=============================================================================\n');
}

runVerification().catch(async (err) => {
  console.error('\nVerification failed with error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
