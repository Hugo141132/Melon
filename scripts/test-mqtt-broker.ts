import fs from 'fs';
import path from 'path';
import mqtt from 'mqtt';
import { getMqttTestCredentials } from './mqtt-config';

export interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

export async function runMqttBrokerVerification(): Promise<{
  allPassed: boolean;
  isBrokerLive: boolean;
  results: VerificationResult[];
}> {
  const results: VerificationResult[] = [];
  const rootDir = process.cwd();
  const creds = getMqttTestCredentials();

  const configPath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'mosquitto.conf');
  const aclPath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'acl.conf');
  const pwfilePath = path.join(rootDir, 'docker', 'mosquitto', 'config', 'pwfile');
  const composePath = path.join(rootDir, 'docker-compose.yml');

  // ---------------------------------------------------------------------------
  // Check 1: Static Broker Configuration Verification
  // ---------------------------------------------------------------------------
  if (!fs.existsSync(configPath)) {
    results.push({
      name: 'Config File Check',
      passed: false,
      message: 'mosquitto.conf file is missing',
    });
  } else {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const hasAnonFalse = /allow_anonymous\s+false/i.test(configContent);
    const hasPwFile = /password_file\s+\/mosquitto\/config\/pwfile/i.test(configContent);
    const hasAclFile = /acl_file\s+\/mosquitto\/config\/acl.conf/i.test(configContent);

    if (hasAnonFalse && hasPwFile && hasAclFile) {
      results.push({
        name: 'Config File Check',
        passed: true,
        message:
          'mosquitto.conf correctly enforces allow_anonymous=false, password_file, and acl_file',
      });
    } else {
      results.push({
        name: 'Config File Check',
        passed: false,
        message:
          'mosquitto.conf missing required parameters (allow_anonymous false, password_file, or acl_file)',
      });
    }
  }

  // Check ACL & PWFile existence
  if (!fs.existsSync(aclPath)) {
    results.push({
      name: 'ACL File Check',
      passed: false,
      message: 'acl.conf file is missing',
    });
  } else {
    const aclContent = fs.readFileSync(aclPath, 'utf8');
    const hasGateway =
      aclContent.includes(`user ${creds.gatewayUsername}`) &&
      aclContent.includes('topic readwrite agriculture/#');
    const hasDevice1Iso =
      aclContent.includes(`user ${creds.device1Username}`) &&
      aclContent.includes(`device_esp32_001`);
    const hasDevice2Iso =
      aclContent.includes(`user ${creds.device2Username}`) &&
      aclContent.includes(`device_node_002`);

    results.push({
      name: 'ACL File Check',
      passed: hasGateway && hasDevice1Iso && hasDevice2Iso,
      message:
        hasGateway && hasDevice1Iso && hasDevice2Iso
          ? 'acl.conf defines gateway_user full access and per-device topic isolation'
          : 'acl.conf missing gateway_user or per-device isolation rules',
    });
  }

  if (!fs.existsSync(pwfilePath)) {
    results.push({
      name: 'Password File Check',
      passed: false,
      message: 'pwfile is missing',
    });
  } else {
    const pwContent = fs.readFileSync(pwfilePath, 'utf8');
    const hasGatewayUser = pwContent.includes(`${creds.gatewayUsername}:$7$`);
    const hasDeviceUser = pwContent.includes(`${creds.device1Username}:$7$`);
    const noPlainText = !pwContent.includes(creds.gatewayPassword);

    results.push({
      name: 'Password File Check',
      passed: hasGatewayUser && hasDeviceUser && noPlainText,
      message:
        hasGatewayUser && hasDeviceUser && noPlainText
          ? 'pwfile contains official mosquitto_passwd hashed credentials ($7$) and no plain text passwords'
          : 'pwfile missing users or contains plain text passwords',
    });
  }

  if (!fs.existsSync(composePath)) {
    results.push({
      name: 'Docker Compose Check',
      passed: false,
      message: 'docker-compose.yml is missing',
    });
  } else {
    const composeContent = fs.readFileSync(composePath, 'utf8');
    const hasMosquittoService =
      composeContent.includes('eclipse-mosquitto:2') && composeContent.includes('1883:1883');
    const noObsoleteVersion =
      !composeContent.startsWith('version:') && !composeContent.includes('version:');

    results.push({
      name: 'Docker Compose Check',
      passed: hasMosquittoService && noObsoleteVersion,
      message:
        hasMosquittoService && noObsoleteVersion
          ? 'docker-compose.yml configures Mosquitto container without obsolete top-level version field'
          : 'docker-compose.yml missing eclipse-mosquitto service or contains obsolete version field',
    });
  }

  // ---------------------------------------------------------------------------
  // Check 2: Live MQTT Network Tests against brokerUrl
  // ---------------------------------------------------------------------------
  const brokerUrl = creds.brokerUrl;
  let isBrokerLive = false;

  // Probe broker reachability
  try {
    isBrokerLive = await new Promise<boolean>((resolve) => {
      const probeClient = mqtt.connect(brokerUrl, {
        connectTimeout: 1500,
        reconnectPeriod: 0,
      });
      probeClient.on('connect', () => {
        probeClient.end(true);
        resolve(true);
      });
      probeClient.on('error', (err) => {
        probeClient.end(true);
        if ((err as any).code === 'ECONNREFUSED') {
          resolve(false);
        } else {
          // Received authentication error from active listening broker port
          resolve(true);
        }
      });
    });
  } catch {
    isBrokerLive = false;
  }

  if (!isBrokerLive) {
    results.push({
      name: 'Live Broker Connectivity',
      passed: false,
      message:
        'Mosquitto container is OFFLINE. Run `docker compose up -d` to start the local MQTT broker container.',
    });

    return {
      allPassed: false,
      isBrokerLive: false,
      results,
    };
  }

  // --- Live Test 1: Anonymous Connection Rejected ---
  const anonTest = await new Promise<VerificationResult>((resolve) => {
    const anonClient = mqtt.connect(brokerUrl, {
      clientId: `anon-test-${Date.now()}`,
      connectTimeout: 2000,
      reconnectPeriod: 0,
    });

    anonClient.on('connect', () => {
      anonClient.end(true);
      resolve({
        name: '1. Anonymous Connection Rejected',
        passed: false,
        message: 'FAIL: Anonymous connection unexpectedly succeeded!',
      });
    });

    anonClient.on('error', (err) => {
      anonClient.end(true);
      resolve({
        name: '1. Anonymous Connection Rejected',
        passed: true,
        message: `PASS: Anonymous connection correctly rejected by broker: ${err.message}`,
      });
    });
  });
  results.push(anonTest);

  // --- Live Test 2: Valid Login Success ---
  const validLoginTest = await new Promise<VerificationResult>((resolve) => {
    const gatewayClient = mqtt.connect(brokerUrl, {
      clientId: `gateway-test-${Date.now()}`,
      username: creds.gatewayUsername,
      password: creds.gatewayPassword,
      connectTimeout: 3000,
      reconnectPeriod: 0,
    });

    gatewayClient.on('connect', () => {
      gatewayClient.end(true);
      resolve({
        name: '2. Valid Login Success',
        passed: true,
        message: `PASS: ${creds.gatewayUsername} successfully authenticated with Mosquitto password file`,
      });
    });

    gatewayClient.on('error', (err) => {
      gatewayClient.end(true);
      resolve({
        name: '2. Valid Login Success',
        passed: false,
        message: `FAIL: ${creds.gatewayUsername} authentication failed: ${err.message}`,
      });
    });
  });
  results.push(validLoginTest);

  // --- Live Test 3: Cross-Device ACL Denial ---
  // Device 2 connects with valid credentials FIRST, then attempts to publish to Device 1's topic.
  const aclDenialTest = await new Promise<VerificationResult>((resolve) => {
    const dev2Client = mqtt.connect(brokerUrl, {
      clientId: `dev2-acl-test-${Date.now()}`,
      username: creds.device2Username,
      password: creds.device2Password,
      protocolVersion: 5,
      connectTimeout: 3000,
      reconnectPeriod: 0,
    });

    dev2Client.on('error', (err) => {
      dev2Client.end(true);
      // Pre-condition: Device 2 authentication must NOT fail!
      resolve({
        name: '3. Cross-Device ACL Denial',
        passed: false,
        message: `FAIL: Pre-condition failed: ${creds.device2Username} authentication failed (${err.message}). Authentication failure does not count as ACL pass!`,
      });
    });

    dev2Client.on('connect', () => {
      // Step 2: Device 2 is authenticated. Attempt to publish to Device 1's isolated topic.
      const targetTopic = `agriculture/development/site-01/${creds.device1Username}/telemetry/soil`;

      dev2Client.publish(
        targetTopic,
        JSON.stringify({ unauthorizedPayload: true }),
        { qos: 1 },
        (pubErr) => {
          dev2Client.end(true);
          if (pubErr) {
            const isAclDenied =
              pubErr.message.includes('Not authorized') || (pubErr as any).code === 135;
            if (isAclDenied) {
              resolve({
                name: '3. Cross-Device ACL Denial',
                passed: true,
                message: `PASS: Authenticated ${creds.device2Username} attempted publish to ${targetTopic} and broker ACL correctly DENIED publication (${pubErr.message})`,
              });
            } else {
              resolve({
                name: '3. Cross-Device ACL Denial',
                passed: false,
                message: `FAIL: Unexpected publish error: ${pubErr.message}`,
              });
            }
          } else {
            resolve({
              name: '3. Cross-Device ACL Denial',
              passed: false,
              message: `FAIL: Authenticated ${creds.device2Username} successfully published to unauthorized device topic ${targetTopic}! ACL isolation violated.`,
            });
          }
        }
      );
    });
  });
  results.push(aclDenialTest);

  // --- Live Test 4: Gateway Permissions ---
  const gatewayPermTest = await new Promise<VerificationResult>((resolve) => {
    const gwClient = mqtt.connect(brokerUrl, {
      clientId: `gw-perm-test-${Date.now()}`,
      username: creds.gatewayUsername,
      password: creds.gatewayPassword,
      connectTimeout: 3000,
      reconnectPeriod: 0,
    });

    gwClient.on('connect', () => {
      gwClient.subscribe('agriculture/+/+/+/telemetry/#', (subErr) => {
        if (subErr) {
          gwClient.end(true);
          resolve({
            name: '4. Gateway Permissions',
            passed: false,
            message: `FAIL: Gateway failed to subscribe: ${subErr.message}`,
          });
          return;
        }

        gwClient.publish(
          `agriculture/development/site-01/${creds.device1Username}/command/faucet`,
          JSON.stringify({ commandId: 'cmd-test-1', phase: 1 }),
          { qos: 1, retain: false },
          (pubErr) => {
            gwClient.end(true);
            if (pubErr) {
              resolve({
                name: '4. Gateway Permissions',
                passed: false,
                message: `FAIL: Gateway failed to publish command: ${pubErr.message}`,
              });
            } else {
              resolve({
                name: '4. Gateway Permissions',
                passed: true,
                message:
                  'PASS: Gateway successfully subscribed to telemetry and published non-retained faucet command',
              });
            }
          }
        );
      });
    });

    gwClient.on('error', (err) => {
      gwClient.end(true);
      resolve({
        name: '4. Gateway Permissions',
        passed: false,
        message: `FAIL: Gateway connection failed: ${err.message}`,
      });
    });
  });
  results.push(gatewayPermTest);

  // --- Live Test 5: Retained Faucet Command Absent ---
  const retainedTest = await new Promise<VerificationResult>((resolve) => {
    const subscriber = mqtt.connect(brokerUrl, {
      clientId: `sub-retain-test-${Date.now()}`,
      username: creds.gatewayUsername,
      password: creds.gatewayPassword,
      connectTimeout: 3000,
      reconnectPeriod: 0,
    });

    let receivedRetained = false;

    subscriber.on('connect', () => {
      subscriber.subscribe(
        `agriculture/development/site-01/${creds.device1Username}/command/faucet`,
        (err) => {
          if (err) {
            subscriber.end(true);
            resolve({
              name: '5. Retained Faucet Command Absent',
              passed: false,
              message: `FAIL: Could not subscribe to command topic: ${err.message}`,
            });
            return;
          }

          // Wait 1 second to verify no retained message is received on initial subscription
          setTimeout(() => {
            subscriber.end(true);
            if (receivedRetained) {
              resolve({
                name: '5. Retained Faucet Command Absent',
                passed: false,
                message:
                  'FAIL: Unexpected retained faucet command received on initial subscription!',
              });
            } else {
              resolve({
                name: '5. Retained Faucet Command Absent',
                passed: true,
                message:
                  'PASS: No retained faucet command received on subscription (retain=false verified)',
              });
            }
          }, 1000);
        }
      );
    });

    subscriber.on('message', (_topic, _payload, packet) => {
      if (packet.retain) {
        receivedRetained = true;
      }
    });

    subscriber.on('error', (err) => {
      subscriber.end(true);
      resolve({
        name: '5. Retained Faucet Command Absent',
        passed: false,
        message: `FAIL: Subscriber error: ${err.message}`,
      });
    });
  });
  results.push(retainedTest);

  return {
    allPassed: results.every((r) => r.passed),
    isBrokerLive: true,
    results,
  };
}

if (require.main === module) {
  runMqttBrokerVerification().then(({ allPassed, isBrokerLive, results }) => {
    console.log('\n============================================================');
    console.log(' Kebun Melon MQTT Broker Verification Report');
    console.log('============================================================');
    console.log(`Broker Live Status: ${isBrokerLive ? 'ONLINE (localhost:1883)' : 'OFFLINE'}\n`);

    for (const r of results) {
      const statusSymbol = r.passed ? '[PASS]' : '[FAIL]';
      console.log(`${statusSymbol} ${r.name}: ${r.message}`);
    }

    console.log('------------------------------------------------------------');
    console.log(`Overall Result: ${allPassed ? 'ALL CHECKS PASSED' : 'VERIFICATION FAILED'}`);
    console.log('============================================================\n');

    if (!allPassed) {
      process.exit(1);
    }
  });
}
