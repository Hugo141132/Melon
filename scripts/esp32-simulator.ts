import mqtt from 'mqtt';
import { getMqttTestCredentials } from './mqtt-config';

/**
 * Minimal MQTT Telemetry Simulator for Staging / Development
 *
 * Enforces contract rules:
 * - Uses existing MQTT contracts from docs/DEVICE_COMMUNICATION.md.
 * - Device ID configured via MQTT_DEVICE_ID (defaults to 'esp32-001').
 * - Environment and credentials loaded from local env via getMqttTestCredentials().
 * - Strictly publishes telemetry only (no status/ONLINE publishing, no faucet commands).
 * - Safe handling of connection errors and graceful disconnects.
 */

async function runSimulator(): Promise<void> {
  const creds = getMqttTestCredentials();

  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'staging';
  const siteId = process.env.MQTT_SITE_ID || 'site-01';
  const deviceId = process.env.MQTT_DEVICE_ID || 'esp32-001';

  // Topic pattern: agriculture/{environment}/{siteId}/{deviceId}/telemetry/reservoir
  const topic = `agriculture/${environment}/${siteId}/${deviceId}/telemetry/reservoir`;

  console.log(`[${deviceId} Simulator] Target Broker: ${creds.brokerUrl}`);
  console.log(`[${deviceId} Simulator] Device ID: ${deviceId}`);
  console.log(`[${deviceId} Simulator] Target Topic: ${topic}`);

  const client = mqtt.connect(creds.brokerUrl, {
    username: creds.device1Username,
    password: creds.device1Password,
    clientId: `sim-${deviceId}-${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    path: '/mqtt',
    reconnectPeriod: 2000,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('MQTT connection timeout'));
    }, 10000);

    client.on('connect', () => {
      clearTimeout(timeout);
      console.log(`[${deviceId} Simulator] Connected to MQTT broker.`);
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });

  // Publish Reservoir Telemetry payload
  const sequenceNumber = Math.floor(Math.random() * 10000);
  const now = new Date().toISOString();
  const telemetryPayload = {
    schemaVersion: '1.0',
    messageId: `msg-sim-${Date.now()}`,
    deviceId,
    siteId,
    sequence: sequenceNumber,
    recordedAt: now,
    sentAt: now,
    firmwareVersion: '1.0.0',
    data: {
      tankVolume: 75.5,
      flowRate: 2.1,
      status: 'NORMAL',
    },
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(telemetryPayload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log(
    `[${deviceId} Simulator] Published reservoir telemetry payload successfully:`,
    telemetryPayload
  );

  // Gracefully close connection
  await new Promise<void>((resolve) => {
    client.end(false, () => {
      console.log(`[${deviceId} Simulator] Disconnected.`);
      resolve();
    });
  });
}

runSimulator().catch((err) => {
  const deviceId = process.env.MQTT_DEVICE_ID || 'esp32-001';
  console.error(`[${deviceId} Simulator] Error during execution:`, err);
  process.exit(1);
});
