#!/usr/bin/env tsx

/**
 * =============================================================================
 * Run IoT Gateway in Development Mode with Hardware Testbed Broker
 * TASK-0411 — Connects to broker.emqx.io:8084 (WSS) without modifying .env
 * =============================================================================
 */

process.env.APP_ENV = process.env.APP_ENV || 'development';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.HARDWARE_ADAPTER_ENABLED = 'true';
process.env.HARDWARE_MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

console.log('=============================================================================');
console.log(' Starting IoT Gateway with Development Hardware Broker:');
console.log(' HARDWARE_MQTT_BROKER_URL = wss://broker.emqx.io:8084/mqtt');
console.log(' Boundary: Hardware -> broker.emqx.io -> Gateway -> DB -> Web');
console.log(' Production EMQX Cloud & Staging: UNTOUCHED');
console.log('=============================================================================\n');

// Import and launch gateway server
import { startServer } from '../apps/iot-gateway/src/index';

startServer().catch((err) => {
  console.error('Fatal error starting development IoT Gateway:', err);
  process.exit(1);
});
