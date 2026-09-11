#!/usr/bin/env tsx

/**
 * =============================================================================
 * Temporary Development MQTT Hardware Communication Verification Runner
 * TASK-0411 — Reconcile Hardware MQTT Contract and Implement Direct Gateway Migration
 * =============================================================================
 *
 * Verifies temporary MQTT hardware communication using broker.emqx.io on port 8084 (WSS)
 * for hardware team integration testing without modifying production or staging configurations.
 *
 * Architectural & Safety Constraints:
 * 1. Scope: Strictly development verification testbed; NEVER used in production/staging.
 * 2. Auth: Anonymous connection over WebSocket Secure (WSS).
 * 3. Topics: Tested on safe isolated dev topic and canonical hardware contract topics:
 *    - irigasi/melon/sensor/volume (Telemetry: Water tank volume)
 *    - irigasi/melon/kontrol/valve (Control: Actuator ON/OFF)
 *    - irigasi/melon/setting/otomasi (Automation: Dispense settings)
 * 4. Normalization: Verified through Gateway HardwareMqttAdapter.
 * 5. Safety: Faucet control safety lock (ENABLE_FAUCET_CONTROL=false) strictly enforced.
 * 6. Boundary: ESP32/NodeMCU -> MQTT Broker -> IoT Gateway -> Backend. Frontend remains REST/SSE.
 *
 * Usage:
 *   npx tsx scripts/verify-hardware-mqtt-dev.ts
 *   npm run mqtt:verify:hw
 * =============================================================================
 */

import mqtt, { MqttClient } from 'mqtt';
import crypto from 'crypto';
import { HardwareMqttAdapter } from '../apps/iot-gateway/src/mqtt/hardware-adapter';
import { PERMANENT_HARDWARE_TOPICS } from '../apps/iot-gateway/src/mqtt/hardware-reconciliation';
import { FaucetCommandAction } from '@kebun-melon/contracts';

export interface VerificationCheckResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

export const DEV_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

function safePublish(client: MqttClient, topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doPub = () => {
      client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    };

    if (client.connected) {
      doPub();
    } else {
      client.once('connect', () => doPub());
    }
  });
}

export async function runDevHardwareMqttVerification(): Promise<{
  allPassed: boolean;
  results: VerificationCheckResult[];
}> {
  const results: VerificationCheckResult[] = [];
  const runId = crypto.randomBytes(4).toString('hex');
  const isolatedTestTopic = `kebun-melon/test/dev/hw-verify-${Date.now()}-${runId}`;

  console.log('\n======================================================================');
  console.log(' Kebun Melon — TASK-0411: Development Hardware MQTT WSS Verification');
  console.log(' Target: broker.emqx.io:8084 (WSS / Anonymous Integration Testbed)');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // Check 1: Anonymous Broker Connectivity over WSS (Port 8084)
  // ---------------------------------------------------------------------------
  console.log('[1/5] Verifying Anonymous WSS Connection to broker.emqx.io:8084...');
  let connClient: MqttClient | null = null;
  const connResult = await new Promise<VerificationCheckResult>((resolve) => {
    const timeout = setTimeout(() => {
      if (connClient) connClient.end(true);
      resolve({
        id: 'HW-DEV-1',
        name: 'Anonymous WSS Broker Connectivity',
        passed: false,
        message: 'Connection timed out after 10s connecting to wss://broker.emqx.io:8084/mqtt',
      });
    }, 10000);

    try {
      connClient = mqtt.connect(DEV_BROKER_URL, {
        clientId: `dev-hw-test-conn-${runId}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 0,
      });

      connClient.on('connect', () => {
        clearTimeout(timeout);
        connClient?.end(true);
        resolve({
          id: 'HW-DEV-1',
          name: 'Anonymous WSS Broker Connectivity',
          passed: true,
          message:
            'Successfully connected anonymously to wss://broker.emqx.io:8084/mqtt over TLS/WSS',
        });
      });

      connClient.on('error', (err) => {
        clearTimeout(timeout);
        connClient?.end(true);
        resolve({
          id: 'HW-DEV-1',
          name: 'Anonymous WSS Broker Connectivity',
          passed: false,
          message: `Broker connection error: ${err.message}`,
        });
      });
    } catch (err: any) {
      clearTimeout(timeout);
      resolve({
        id: 'HW-DEV-1',
        name: 'Anonymous WSS Broker Connectivity',
        passed: false,
        message: `Failed to initiate MQTT client: ${err.message}`,
      });
    }
  });
  results.push(connResult);
  console.log(` -> [${connResult.passed ? 'PASS' : 'FAIL'}] ${connResult.message}`);

  if (!connResult.passed) {
    console.error('\nCannot continue verification: unable to connect to broker.emqx.io.');
    return { allPassed: false, results };
  }

  // ---------------------------------------------------------------------------
  // Check 2: Isolated Pub/Sub Round-Trip Flow (QoS 1)
  // ---------------------------------------------------------------------------
  console.log('\n[2/5] Verifying Isolated Pub/Sub Flow over WSS...');
  const pubSubResult = await new Promise<VerificationCheckResult>((resolve) => {
    let subClient: MqttClient | null = null;
    let pubClient: MqttClient | null = null;
    let resolved = false;

    const cleanup = () => {
      if (subClient) subClient.end(true);
      if (pubClient) pubClient.end(true);
    };

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        id: 'HW-DEV-2',
        name: 'Isolated Pub/Sub Message Flow',
        passed: false,
        message: 'Timeout waiting for isolated test message loopback',
      });
    }, 12000);

    const testPayload = JSON.stringify({
      testId: runId,
      timestamp: Date.now(),
      origin: 'hardware-verification-runner',
    });

    try {
      subClient = mqtt.connect(DEV_BROKER_URL, {
        clientId: `dev-sub-${runId}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 0,
      });

      subClient.on('connect', () => {
        subClient!.subscribe(isolatedTestTopic, { qos: 1 }, async (subErr) => {
          if (subErr) {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve({
              id: 'HW-DEV-2',
              name: 'Isolated Pub/Sub Message Flow',
              passed: false,
              message: `Failed to subscribe to test topic: ${subErr.message}`,
            });
            return;
          }

          // Now connect publisher and publish
          try {
            pubClient = mqtt.connect(DEV_BROKER_URL, {
              clientId: `dev-pub-${runId}`,
              clean: true,
              connectTimeout: 8000,
              reconnectPeriod: 0,
            });

            await safePublish(pubClient, isolatedTestTopic, testPayload);
          } catch (pubErr: any) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve({
                id: 'HW-DEV-2',
                name: 'Isolated Pub/Sub Message Flow',
                passed: false,
                message: `Failed to publish to test topic: ${pubErr.message}`,
              });
            }
          }
        });
      });

      subClient.on('message', (topic, payload) => {
        if (topic === isolatedTestTopic && !resolved) {
          try {
            const parsed = JSON.parse(payload.toString());
            if (parsed.testId === runId) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve({
                id: 'HW-DEV-2',
                name: 'Isolated Pub/Sub Message Flow',
                passed: true,
                message: `Pub/Sub round-trip succeeded on isolated topic (${isolatedTestTopic}) with QoS 1`,
              });
            }
          } catch {
            // Ignore non-matching
          }
        }
      });

      subClient.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({
            id: 'HW-DEV-2',
            name: 'Isolated Pub/Sub Message Flow',
            passed: false,
            message: `Subscriber client error: ${err.message}`,
          });
        }
      });
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve({
          id: 'HW-DEV-2',
          name: 'Isolated Pub/Sub Message Flow',
          passed: false,
          message: `Pub/Sub setup error: ${err.message}`,
        });
      }
    }
  });
  results.push(pubSubResult);
  console.log(` -> [${pubSubResult.passed ? 'PASS' : 'FAIL'}] ${pubSubResult.message}`);

  // ---------------------------------------------------------------------------
  // Check 3: Canonical Hardware Telemetry Ingestion (irigasi/melon/sensor/volume)
  // ---------------------------------------------------------------------------
  console.log('\n[3/5] Verifying Canonical Hardware Volume Topic Flow...');
  const volumeTopic = PERMANENT_HARDWARE_TOPICS.topicVolume;
  const testVolume = 145.8;
  const telemetryFlowResult = await new Promise<VerificationCheckResult>((resolve) => {
    let subClient: MqttClient | null = null;
    let pubClient: MqttClient | null = null;
    let resolved = false;

    const cleanup = () => {
      if (subClient) subClient.end(true);
      if (pubClient) pubClient.end(true);
    };

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        id: 'HW-DEV-3',
        name: 'Hardware Volume Telemetry Flow',
        passed: false,
        message: `Timeout waiting for volume message on ${volumeTopic}`,
      });
    }, 12000);

    const testPayload = JSON.stringify({
      volume: testVolume,
      testNonce: runId,
      timestamp: Date.now(),
    });

    try {
      subClient = mqtt.connect(DEV_BROKER_URL, {
        clientId: `dev-vol-sub-${runId}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 0,
      });

      subClient.on('connect', () => {
        subClient!.subscribe(volumeTopic, { qos: 1 }, async (subErr) => {
          if (subErr && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve({
              id: 'HW-DEV-3',
              name: 'Hardware Volume Telemetry Flow',
              passed: false,
              message: `Failed to subscribe to ${volumeTopic}: ${subErr.message}`,
            });
            return;
          }

          try {
            pubClient = mqtt.connect(DEV_BROKER_URL, {
              clientId: `dev-vol-pub-${runId}`,
              clean: true,
              connectTimeout: 8000,
              reconnectPeriod: 0,
            });

            await safePublish(pubClient, volumeTopic, testPayload);
          } catch (pubErr: any) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve({
                id: 'HW-DEV-3',
                name: 'Hardware Volume Telemetry Flow',
                passed: false,
                message: `Failed to publish to ${volumeTopic}: ${pubErr.message}`,
              });
            }
          }
        });
      });

      subClient.on('message', (topic, payload) => {
        if (topic === volumeTopic && !resolved) {
          try {
            const rawStr = payload.toString();
            if (rawStr.includes(runId)) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve({
                id: 'HW-DEV-3',
                name: 'Hardware Volume Telemetry Flow',
                passed: true,
                message: `Hardware telemetry published and received on canonical topic ${volumeTopic} (value: ${testVolume} L)`,
              });
            }
          } catch {
            // Ignore non-matching
          }
        }
      });
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve({
          id: 'HW-DEV-3',
          name: 'Hardware Volume Telemetry Flow',
          passed: false,
          message: `Volume flow error: ${err.message}`,
        });
      }
    }
  });
  results.push(telemetryFlowResult);
  console.log(
    ` -> [${telemetryFlowResult.passed ? 'PASS' : 'FAIL'}] ${telemetryFlowResult.message}`
  );

  // ---------------------------------------------------------------------------
  // Check 4: IoT Gateway Normalization & Range Validation
  // ---------------------------------------------------------------------------
  console.log('\n[4/5] Verifying IoT Gateway Payload Normalization & Range Validation...');
  const adapter = new HardwareMqttAdapter();

  const numNorm = adapter.normalizeRawVolume('145.8');
  const jsonNorm1 = adapter.normalizeRawVolume(JSON.stringify({ volume: 210.5 }));
  const jsonNorm2 = adapter.normalizeRawVolume(JSON.stringify({ tankVolume: 500 }));
  const jsonNorm3 = adapter.normalizeRawVolume(JSON.stringify({ liter: 12.3 }));
  const invalidNegative = adapter.normalizeRawVolume('-10');
  const invalidString = adapter.normalizeRawVolume('abc');
  const invalidEmpty = adapter.normalizeRawVolume('');

  const normalizationCorrect =
    numNorm === 145.8 &&
    jsonNorm1 === 210.5 &&
    jsonNorm2 === 500 &&
    jsonNorm3 === 12.3 &&
    invalidNegative === null &&
    invalidString === null &&
    invalidEmpty === null;

  results.push({
    id: 'HW-DEV-4',
    name: 'Gateway Hardware Payload Normalization',
    passed: normalizationCorrect,
    message: normalizationCorrect
      ? 'HardwareMqttAdapter correctly normalizes primitives, JSON envelopes ({ volume, tankVolume, liter }), and rejects negative/invalid payloads'
      : `FAIL: Normalization mismatch (num=${numNorm}, json1=${jsonNorm1}, neg=${invalidNegative})`,
  });
  console.log(
    ` -> [${normalizationCorrect ? 'PASS' : 'FAIL'}] ${results[results.length - 1].message}`
  );

  // ---------------------------------------------------------------------------
  // Check 5: Actuator Command Wire Format Translation & Safety Lock
  // ---------------------------------------------------------------------------
  console.log('\n[5/5] Verifying Actuator Command Translation & Faucet Safety Locks...');
  const openCmd = adapter.translateCommand({ action: FaucetCommandAction.OPEN });
  const closeCmd = adapter.translateCommand({ action: FaucetCommandAction.CLOSE });
  const dispenseCmd = adapter.translateCommand({
    action: FaucetCommandAction.DISPENSE,
    targetVolumeMl: 1500,
  });

  const openValid =
    openCmd?.topic === PERMANENT_HARDWARE_TOPICS.topicValve &&
    openCmd?.payload === 'ON' &&
    openCmd?.qos === 1 &&
    openCmd?.retain === false;

  const closeValid =
    closeCmd?.topic === PERMANENT_HARDWARE_TOPICS.topicValve &&
    closeCmd?.payload === 'OFF' &&
    closeCmd?.qos === 1 &&
    closeCmd?.retain === false;

  let dispensePayloadValid = false;
  try {
    const parsedDispense = JSON.parse(dispenseCmd?.payload || '{}');
    dispensePayloadValid =
      dispenseCmd?.topic === PERMANENT_HARDWARE_TOPICS.topicOtomasi &&
      parsedDispense.mode === 'AUTO' &&
      parsedDispense.target_liter === 1.5 &&
      dispenseCmd?.qos === 1 &&
      dispenseCmd?.retain === false;
  } catch {
    dispensePayloadValid = false;
  }

  // Verify safety lock rejection when ENABLE_FAUCET_CONTROL=false
  const safetyDispatch = await adapter.dispatchHardwareCommand({
    action: FaucetCommandAction.OPEN,
  });
  const safetyLockHonored =
    safetyDispatch.published === false &&
    safetyDispatch.reason === 'ENABLE_FAUCET_CONTROL_DISABLED';

  const commandsValid = openValid && closeValid && dispensePayloadValid && safetyLockHonored;

  results.push({
    id: 'HW-DEV-5',
    name: 'Actuator Command Translation & Safety Lock',
    passed: commandsValid,
    message: commandsValid
      ? 'OPEN/CLOSE mapped to valve ON/OFF (QoS 1, retain: false), DISPENSE mapped to automation JSON ({ mode: "AUTO", target_liter: 1.5 }), and ENABLE_FAUCET_CONTROL=false safety lock enforced'
      : 'FAIL: Command translation or safety lock verification failed',
  });
  console.log(` -> [${commandsValid ? 'PASS' : 'FAIL'}] ${results[results.length - 1].message}`);

  // ---------------------------------------------------------------------------
  // Summary & Hardware Team Onboarding Notes
  // ---------------------------------------------------------------------------
  const allPassed = results.every((r) => r.passed);
  console.log('\n======================================================================');
  console.log(` SUMMARY: ${allPassed ? 'ALL CHECKS PASSED (5/5)' : 'SOME CHECKS FAILED'}`);
  console.log('======================================================================');

  console.log('\n--- Hardware Team Developer Guidelines (Temporary Integration Testbed) ---');
  console.log('1. Broker Endpoint: wss://broker.emqx.io:8084/mqtt');
  console.log('2. Port: 8084 (WSS / WebSocket Secure)');
  console.log('3. Authentication: Anonymous (no username/password needed for initial test)');
  console.log('4. Telemetry Publishing (Tank Volume):');
  console.log('   - Topic: irigasi/melon/sensor/volume');
  console.log('   - Wire Format: Number string ("125.5") or JSON ({"volume": 125.5})');
  console.log('   - QoS: 1, Retain: false');
  console.log('5. Valve Actuation Subscription (Receiving Commands from Gateway):');
  console.log('   - Topic: irigasi/melon/kontrol/valve');
  console.log('   - Wire Format: "ON" (valve open), "OFF" (valve close)');
  console.log('   - QoS: 1, Retain: false');
  console.log('6. Automated Dispensing Subscription:');
  console.log('   - Topic: irigasi/melon/setting/otomasi');
  console.log('   - Wire Format: {"mode": "AUTO", "target_liter": 1.5}');
  console.log('   - QoS: 1, Retain: false');
  console.log('\n--- Future Migration to Production (TASK-0907 Cluster) ---');
  console.log('1. Production Broker: wss://he100b10.ala.asia-southeast1.emqxsl.com:8084/mqtt');
  console.log('2. Device Credentials Required:');
  console.log('   - Username: Test_Device');
  console.log('   - Password: [Provisioned secure password]');
  console.log('   - Client ID: Unique device identifier (e.g. water-tank-node-zi37gz)');
  console.log('3. Production ACL:');
  console.log('   - Publish allowed only to: irigasi/melon/sensor/volume');
  console.log(
    '   - Subscribe allowed only to: irigasi/melon/kontrol/valve, irigasi/melon/setting/otomasi'
  );
  console.log('4. Safety Watchdog (DEC-CTRL-090):');
  console.log('   - Firmware must automatically close the valve if Wi-Fi or MQTT disconnects.\n');

  return { allPassed, results };
}

if (require.main === module) {
  runDevHardwareMqttVerification()
    .then(({ allPassed }) => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('\nFatal error running hardware MQTT verification:', err);
      process.exit(1);
    });
}
