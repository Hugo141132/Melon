import fs from 'fs';
import path from 'path';

/**
 * Development MQTT Broker Test Credentials & Configuration Helper
 *
 * Loads MQTT test credentials EXCLUSIVELY from local ignored environment files
 * (.env, .env.local, apps/iot-gateway/.env, apps/iot-gateway/.env.local).
 *
 * Does NOT read from .env.example or auto-copy templates into runtime environments.
 * Fails fast with actionable setup instructions if credentials are missing or placeholders.
 */

export interface MqttTestCredentials {
  gatewayUsername: string;
  gatewayPassword: string;
  device1Username: string;
  device1Password: string;
  device2Username: string;
  device2Password: string;
  unauthUsername: string;
  unauthPassword: string;
  brokerUrl: string;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function loadLocalIgnoredEnv(): void {
  const root = process.cwd();
  // Candidate local ignored env paths ONLY (never load .env.example)
  const ignoredEnvPaths = [
    path.join(root, '.env.local'),
    path.join(root, '.env'),
    path.join(root, 'apps', 'iot-gateway', '.env.local'),
    path.join(root, 'apps', 'iot-gateway', '.env'),
  ];

  for (const envPath of ignoredEnvPaths) {
    const parsed = parseEnvFile(envPath);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key] && value) {
        process.env[key] = value;
      }
    }
  }
}

function requireConfigEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '' || value.startsWith('CHANGE_ME')) {
    throw new Error(
      `\n============================================================\n` +
        ` [MQTT CONFIG ERROR] Missing or placeholder environment variable: ${name}\n` +
        `============================================================\n` +
        ` To fix this issue:\n` +
        ` 1. Create or edit your local gitignored .env file in project root.\n` +
        ` 2. Set valid local development values for:\n` +
        `    - MQTT_GATEWAY_USERNAME & MQTT_GATEWAY_PASSWORD\n` +
        `    - MQTT_DEV1_USERNAME & MQTT_DEV1_PASSWORD\n` +
        `    - MQTT_UNAUTH_USERNAME & MQTT_UNAUTH_PASSWORD\n` +
        ` 3. Refer to .env.example for required variable names.\n` +
        `============================================================\n`
    );
  }
  return value;
}
export function getMqttTestCredentials(): MqttTestCredentials {
  loadLocalIgnoredEnv();
  return {
    gatewayUsername: requireConfigEnv('MQTT_GATEWAY_USERNAME'),
    gatewayPassword: requireConfigEnv('MQTT_GATEWAY_PASSWORD'),
    device1Username: requireConfigEnv('MQTT_DEV1_USERNAME'),
    device1Password: requireConfigEnv('MQTT_DEV1_PASSWORD'),
    device2Username: process.env.MQTT_DEV2_USERNAME || 'device_node_002',
    device2Password: process.env.MQTT_DEV2_PASSWORD || 'local_dev2_password_12345',
    unauthUsername: requireConfigEnv('MQTT_UNAUTH_USERNAME'),
    unauthPassword: requireConfigEnv('MQTT_UNAUTH_PASSWORD'),
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  };
}

export interface MqttSimulatorCredentials {
  brokerUrl: string;
  username: string;
  password: string;
  deviceId: string;
}

export function getMqttSimulatorCredentials(): MqttSimulatorCredentials {
  loadLocalIgnoredEnv();
  return {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_STAGING_USERNAME || requireConfigEnv('MQTT_DEV1_USERNAME'),
    password: process.env.MQTT_STAGING_PASSWORD || requireConfigEnv('MQTT_DEV1_PASSWORD'),
    deviceId: process.env.MQTT_DEVICE_ID || 'esp32-001',
  };
}
