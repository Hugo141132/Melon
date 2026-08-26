import { DeviceSimulator } from './device-simulator';

/**
 * CLI Wrapper for Water Tank Node Telemetry Simulation (sim:esp32-001)
 * Simulates reservoir telemetry over MQTT/TLS. Target device ID is resolved
 * from CLI flags (--tank-device-id / --device-id) or environment variables
 * (MQTT_TANK_DEVICE_ID / MQTT_DEVICE_ID).
 */
async function runSimulator(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const arg = args.find((a) => a.startsWith(prefix));
    if (arg) return arg.slice(prefix.length);
    const flagIndex = args.indexOf(`--${name}`);
    if (flagIndex !== -1 && args[flagIndex + 1] && !args[flagIndex + 1].startsWith('--')) {
      return args[flagIndex + 1];
    }
    return undefined;
  };

  const tankDeviceId = getArg('tank-device-id') || getArg('device-id');
  const simulator = new DeviceSimulator({
    tankDeviceId,
    deviceId: tankDeviceId,
  });

  const res = await simulator.publishReservoirTelemetry();
  const tankId = simulator.getTankDeviceId();
  console.log(`[${tankId} Simulator] Target Broker: ${simulator.config.brokerUrl}`);
  console.log(`[${tankId} Simulator] Device ID: ${tankId}`);
  console.log(`[${tankId} Simulator] Target Topic: ${res.topic}`);
  console.log(
    `[${tankId} Simulator] Published reservoir telemetry payload successfully:`,
    res.payload
  );
  await simulator.disconnect();
}

runSimulator().catch((err: Error) => {
  console.error(`[Reservoir Simulator] Error during execution:`, err.message || err);
  process.exit(1);
});
