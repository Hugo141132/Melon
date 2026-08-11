import { DeviceSimulator } from './device-simulator';

/**
 * Legacy CLI Wrapper for Device Simulator (sim:esp32-001)
 * Delegates to DeviceSimulator in scripts/device-simulator.ts
 */
async function runSimulator(): Promise<void> {
  const simulator = new DeviceSimulator();
  const res = await simulator.publishReservoirTelemetry();
  console.log(
    `[${simulator.config.deviceId} Simulator] Target Broker: ${simulator.config.brokerUrl}`
  );
  console.log(`[${simulator.config.deviceId} Simulator] Device ID: ${simulator.config.deviceId}`);
  console.log(`[${simulator.config.deviceId} Simulator] Target Topic: ${res.topic}`);
  console.log(
    `[${simulator.config.deviceId} Simulator] Published reservoir telemetry payload successfully:`,
    res.payload
  );
  await simulator.disconnect();
}

runSimulator().catch((err) => {
  const deviceId = process.env.MQTT_DEVICE_ID || 'esp32-001';
  console.error(`[${deviceId} Simulator] Error during execution:`, err);
  process.exit(1);
});
