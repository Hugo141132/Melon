import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { commandPublisher } from '../commands/publisher';
import { GatewayMqttClient } from '../mqtt/client';
import { generateMosquittoHash, writePwfile } from '../../../../scripts/generate-mqtt-pwfile';

/**
 * TASK-0402: MQTT Broker Configuration & Security Controls
 *
 * These tests verify static broker configuration files and the CommandPublisher
 * retain=false policy. They do NOT require real credentials or a live broker.
 *
 * Expected usernames are loaded from environment variables to stay consistent
 * with the local environment's acl.conf. Usernames are not secrets and are
 * also listed in the tracked acl.conf file.
 *
 * Passwords are never read here. The pwfile plaintext check uses format-level
 * assertions (all hash entries must match the $7$ PBKDF2-SHA512 pattern).
 */

const getExpectedUsernames = () => ({
  gatewayUsername: process.env.MQTT_GATEWAY_USERNAME ?? 'gateway_user',
  device1Username: process.env.MQTT_DEV1_USERNAME ?? 'device_esp32_001',
  device2Username: process.env.MQTT_DEV2_USERNAME ?? 'device_node_002',
  unauthUsername: process.env.MQTT_UNAUTH_USERNAME ?? 'unauthorized_device',
});

describe('TASK-0402: MQTT Broker Configuration & Security Controls', () => {
  const rootDir = path.join(__dirname, '..', '..', '..', '..');
  const mosquittoConfPath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'mosquitto.conf');
  const aclConfPath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'acl.conf');
  const pwfilePath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'pwfile');
  const pwfileExamplePath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'pwfile.example');
  const dockerComposePath = path.join(rootDir, 'docker-compose.yml');

  const usernames = getExpectedUsernames();

  beforeAll(() => {
    if (!fs.existsSync(pwfilePath)) {
      writePwfile();
    }
  });

  it('verifies mosquitto.conf strictly disables anonymous access and links security files', () => {
    expect(fs.existsSync(mosquittoConfPath)).toBe(true);
    const content = fs.readFileSync(mosquittoConfPath, 'utf8');

    // Anonymous access must be OFF
    expect(content).toMatch(/allow_anonymous\s+false/i);
    // Password file path inside container
    expect(content).toMatch(/password_file\s+\/mosquitto\/config\/pwfile/i);
    // ACL file path inside container
    expect(content).toMatch(/acl_file\s+\/mosquitto\/config\/acl.conf/i);
    // Port listener 1883
    expect(content).toMatch(/listener\s+1883/i);
  });

  it('verifies acl.conf enforces gateway full access and per-device topic isolation', () => {
    expect(fs.existsSync(aclConfPath)).toBe(true);
    const content = fs.readFileSync(aclConfPath, 'utf8');

    // Gateway User permissions
    expect(content).toContain(`user ${usernames.gatewayUsername}`);
    expect(content).toContain('topic readwrite agriculture/#');

    // Isolated Device 1 permissions
    expect(content).toContain(`user ${usernames.device1Username}`);
    expect(content).toContain(
      `topic write agriculture/+/+/${usernames.device1Username}/telemetry/#`
    );
    expect(content).toContain(`topic read agriculture/+/+/${usernames.device1Username}/command/#`);

    // Isolated Device 2 permissions
    expect(content).toContain(`user ${usernames.device2Username}`);
    expect(content).toContain(
      `topic write agriculture/+/+/${usernames.device2Username}/telemetry/#`
    );
    expect(content).toContain(`topic read agriculture/+/+/${usernames.device2Username}/command/#`);

    // Unauthorized test device isolation
    expect(content).toContain(`user ${usernames.unauthUsername}`);
    expect(content).toContain(
      `topic write agriculture/+/+/${usernames.unauthUsername}/telemetry/#`
    );
  });

  it('verifies pwfile contains only official mosquitto_passwd hashed entries ($7$) — no plaintext passwords', () => {
    expect(fs.existsSync(pwfilePath)).toBe(true);
    const content = fs.readFileSync(pwfilePath, 'utf8');

    // All four expected users must be present
    expect(content).toContain(`${usernames.gatewayUsername}:$7$`);
    expect(content).toContain(`${usernames.device1Username}:$7$`);
    expect(content).toContain(`${usernames.device2Username}:$7$`);
    expect(content).toContain(`${usernames.unauthUsername}:$7$`);

    // Every non-empty, non-comment line must be a valid username:$7$hash entry
    const credentialLines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    for (const line of credentialLines) {
      expect(line).toMatch(/^[^:]+:\$7\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    }
  });

  it('verifies pwfile.example is tracked and contains no real hashes or passwords', () => {
    expect(fs.existsSync(pwfileExamplePath)).toBe(true);
    const content = fs.readFileSync(pwfileExamplePath, 'utf8');

    // Must be all comments / documentation
    const nonCommentLines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    // No credential lines should exist in the template
    expect(nonCommentLines).toHaveLength(0);
  });

  it('verifies Mosquitto password hash format generator ($7$)', () => {
    const hash = generateMosquittoHash('testpassword123');
    expect(hash).toMatch(/^\$7\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('verifies docker-compose.yml defines eclipse-mosquitto service and volume mounts without obsolete version field', () => {
    expect(fs.existsSync(dockerComposePath)).toBe(true);
    const content = fs.readFileSync(dockerComposePath, 'utf8');

    expect(content).toContain('eclipse-mosquitto:2');
    expect(content).toContain('kebun-melon-mosquitto');
    expect(content).toContain('1883:1883');
    expect(content).toContain(
      './docker/mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro'
    );
    expect(content).toContain('./docker/mosquitto/config/acl.conf:/mosquitto/config/acl.conf:ro');
    expect(content).toContain('./docker/mosquitto/config/pwfile:/mosquitto/config/pwfile:ro');

    // Assert top-level version field is absent
    expect(content.startsWith('version:')).toBe(false);
    expect(content.includes('version:')).toBe(false);
  });

  it('verifies CommandPublisher strictly enforces retain=false for faucet control commands', async () => {
    const mockMqttClient = {
      isConnected: () => true,
      publish: async (_topic: string, _message: Buffer, _qos: number, retain: boolean) => {
        // Assert retain flag MUST be false
        expect(retain).toBe(false);
      },
    } as unknown as GatewayMqttClient;

    const res = await commandPublisher.publishCommand(
      mockMqttClient,
      usernames.device1Username,
      'cmd-100',
      {
        phase: 1,
        targetVolumeMl: 300,
      }
    );

    expect(res.published).toBe(true);
  });
});
