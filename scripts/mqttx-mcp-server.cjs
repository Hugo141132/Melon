#!/usr/bin/env node

/**
 * MQTTX MCP Server (Model Context Protocol for MQTT & EMQX)
 *
 * Provides interactive tools for testing connections, publishing,
 * subscribing, and benchmarking roundtrip latency to any MQTT broker
 * (EMQX Cloud, local Mosquitto, HiveMQ, etc.) via MQTT 3.1.1 / MQTT 5.0.
 *
 * Designed for standard JSON-RPC 2.0 stdio MCP clients (Antigravity, Gemini, Claude, Cursor).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Robust module resolution for 'mqtt'
let mqtt;
try {
  mqtt = require('mqtt');
} catch (e1) {
  try {
    mqtt = require(path.resolve(__dirname, '..', 'node_modules', 'mqtt'));
  } catch (e2) {
    process.stderr.write(`[MQTTX-MCP] Error loading 'mqtt' package: ${e2.message}\n`);
    process.exit(1);
  }
}

// Helper to parse env file
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

// Load fallback defaults from .env.staging or .env
const projectRoot = path.resolve(__dirname, '..');
const stagingEnv = parseEnvFile(path.join(projectRoot, '.env.staging'));
const localEnv = parseEnvFile(path.join(projectRoot, '.env'));

function getEnvValue(key, defaultVal = '') {
  return process.env[key] || stagingEnv[key] || localEnv[key] || defaultVal;
}

const DEFAULT_BROKER_URL = getEnvValue(
  'MQTT_BROKER_URL',
  'wss://he100b10.ala.asia-southeast1.emqxsl.com:8084/mqtt'
);
const DEFAULT_USERNAME = getEnvValue('MQTT_GATEWAY_USERNAME', 'Test_gateway');
const DEFAULT_PASSWORD = getEnvValue('MQTT_GATEWAY_PASSWORD', '');
const DEFAULT_CLIENT_ID = getEnvValue('MQTT_GATEWAY_CLIENT_ID', 'MQTTX_Probe_Client');

function log(...args) {
  process.stderr.write(`[MQTTX-MCP] ${args.join(' ')}\n`);
}

/**
 * Tool 1: Test Connection
 */
async function testConnection(options = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER_URL;
  const username = options.username !== undefined ? options.username : DEFAULT_USERNAME;
  const password = options.password !== undefined ? options.password : DEFAULT_PASSWORD;
  const clientId = options.clientId || `${DEFAULT_CLIENT_ID}_${Math.floor(Math.random() * 100000)}`;
  const protocolVersion = options.protocolVersion || 5;
  const timeoutMs = options.timeoutMs || 8000;
  const rejectUnauthorized = options.rejectUnauthorized !== false;
  const clean = options.cleanSession !== false;

  const startTime = Date.now();

  return new Promise((resolve) => {
    let client = null;
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (client) {
        try {
          client.end(true);
        } catch {}
      }
      resolve({
        connected: false,
        brokerUrl,
        username: username || '(anonymous)',
        clientId,
        protocolVersion: `MQTT ${protocolVersion === 5 ? '5.0' : '3.1.1'}`,
        latencyMs: Date.now() - startTime,
        error: `Connection timed out after ${timeoutMs}ms`,
        hint: 'Check if the broker URL, port, protocol (wss://, mqtts://, mqtt://), or network/firewall permits connection.',
      });
    }, timeoutMs);

    try {
      client = mqtt.connect(brokerUrl, {
        clientId,
        username,
        password,
        protocolVersion,
        clean,
        connectTimeout: timeoutMs,
        rejectUnauthorized,
        reconnectPeriod: 0, // No auto reconnect
      });

      client.on('connect', (connack) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;

        const result = {
          connected: true,
          status: 'SUCCESS',
          brokerUrl,
          username: username || '(anonymous)',
          clientId,
          protocolVersion: `MQTT ${protocolVersion === 5 ? '5.0' : '3.1.1'}`,
          handshakeLatencyMs: latencyMs,
          sessionPresent: connack?.sessionPresent || false,
          reasonCode: connack?.reasonCode !== undefined ? connack.reasonCode : 0,
          connackProperties: connack?.properties || null,
        };

        try {
          client.end(false, () => {});
        } catch {}

        resolve(result);
      });

      client.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;

        try {
          client.end(true);
        } catch {}

        resolve({
          connected: false,
          status: 'FAILED',
          brokerUrl,
          username: username || '(anonymous)',
          clientId,
          protocolVersion: `MQTT ${protocolVersion === 5 ? '5.0' : '3.1.1'}`,
          latencyMs,
          error: err.message || String(err),
          code: err.code || null,
        });
      });

      client.on('close', () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          connected: false,
          status: 'CLOSED',
          brokerUrl,
          latencyMs: Date.now() - startTime,
          error: 'Connection closed unexpectedly by broker during handshake.',
        });
      });
    } catch (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        connected: false,
        status: 'EXCEPTION',
        brokerUrl,
        error: err.message,
      });
    }
  });
}

/**
 * Tool 2: Publish Message
 */
async function publishMessage(options = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER_URL;
  const username = options.username !== undefined ? options.username : DEFAULT_USERNAME;
  const password = options.password !== undefined ? options.password : DEFAULT_PASSWORD;
  const clientId =
    options.clientId || `${DEFAULT_CLIENT_ID}_pub_${Math.floor(Math.random() * 100000)}`;
  const topic = options.topic;
  const payload =
    typeof options.payload === 'object'
      ? JSON.stringify(options.payload)
      : String(options.payload || '');
  const qos = options.qos !== undefined ? Number(options.qos) : 0;
  const retain = Boolean(options.retain);
  const timeoutMs = options.timeoutMs || 8000;

  if (!topic) {
    throw new Error("Missing required 'topic' parameter");
  }

  const startTime = Date.now();

  return new Promise((resolve) => {
    let client = null;
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (client) {
        try {
          client.end(true);
        } catch {}
      }
      resolve({
        success: false,
        topic,
        error: `Publish timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    try {
      client = mqtt.connect(brokerUrl, {
        clientId,
        username,
        password,
        protocolVersion: 5,
        connectTimeout: timeoutMs,
        reconnectPeriod: 0,
      });

      client.on('connect', () => {
        client.publish(topic, payload, { qos, retain }, (err, packet) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          const elapsedMs = Date.now() - startTime;

          try {
            client.end(false);
          } catch {}

          if (err) {
            resolve({
              success: false,
              topic,
              error: err.message,
              elapsedMs,
            });
          } else {
            resolve({
              success: true,
              topic,
              qos,
              retain,
              payloadSize: Buffer.byteLength(payload, 'utf8'),
              elapsedMs,
              packetInfo: packet
                ? { messageId: packet.messageId, reasonCode: packet.reasonCode }
                : null,
            });
          }
        });
      });

      client.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          client.end(true);
        } catch {}
        resolve({
          success: false,
          topic,
          error: `Connection error: ${err.message}`,
        });
      });
    } catch (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        success: false,
        topic,
        error: err.message,
      });
    }
  });
}

/**
 * Tool 3: Subscribe and capture messages
 */
async function subscribeTopic(options = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER_URL;
  const username = options.username !== undefined ? options.username : DEFAULT_USERNAME;
  const password = options.password !== undefined ? options.password : DEFAULT_PASSWORD;
  const clientId =
    options.clientId || `${DEFAULT_CLIENT_ID}_sub_${Math.floor(Math.random() * 100000)}`;
  const topic = options.topic;
  const qos = options.qos !== undefined ? Number(options.qos) : 0;
  const timeoutMs = options.timeoutMs || 5000;
  const maxMessages = options.maxMessages || 5;

  if (!topic) {
    throw new Error("Missing required 'topic' parameter");
  }

  const startTime = Date.now();
  const receivedMessages = [];

  return new Promise((resolve) => {
    let client = null;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (client) {
        try {
          client.end(false);
        } catch {}
      }
      resolve({
        topic,
        messageCount: receivedMessages.length,
        durationMs: Date.now() - startTime,
        messages: receivedMessages,
      });
    }

    const timer = setTimeout(finish, timeoutMs);

    try {
      client = mqtt.connect(brokerUrl, {
        clientId,
        username,
        password,
        protocolVersion: 5,
        connectTimeout: timeoutMs,
        reconnectPeriod: 0,
      });

      client.on('connect', () => {
        client.subscribe(topic, { qos }, (err, granted) => {
          if (err) {
            clearTimeout(timer);
            if (finished) return;
            finished = true;
            try {
              client.end(true);
            } catch {}
            resolve({
              topic,
              error: `Subscription failed: ${err.message}`,
              messageCount: 0,
              messages: [],
            });
          }
        });
      });

      client.on('message', (msgTopic, payloadBuffer, packet) => {
        const rawText = payloadBuffer.toString('utf8');
        let parsedPayload = rawText;
        try {
          parsedPayload = JSON.parse(rawText);
        } catch {}

        receivedMessages.push({
          topic: msgTopic,
          payload: parsedPayload,
          qos: packet.qos,
          retain: packet.retain,
          timestamp: new Date().toISOString(),
        });

        if (receivedMessages.length >= maxMessages) {
          clearTimeout(timer);
          finish();
        }
      });

      client.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          client.end(true);
        } catch {}
        resolve({
          topic,
          error: `Connection error: ${err.message}`,
          messageCount: receivedMessages.length,
          messages: receivedMessages,
        });
      });
    } catch (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        topic,
        error: err.message,
        messageCount: 0,
        messages: [],
      });
    }
  });
}

/**
 * Tool 4: End-to-end ping roundtrip test
 */
async function pingRoundtrip(options = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER_URL;
  const username = options.username !== undefined ? options.username : DEFAULT_USERNAME;
  const password = options.password !== undefined ? options.password : DEFAULT_PASSWORD;
  const clientId =
    options.clientId || `${DEFAULT_CLIENT_ID}_ping_${Math.floor(Math.random() * 100000)}`;
  const topic = options.topic || `melon/system/ping-test-${Math.floor(Math.random() * 100000)}`;
  const timeoutMs = options.timeoutMs || 8000;

  const probeNonce = `probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    let client = null;
    let finished = false;
    let publishTimestamp = 0;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (client) {
        try {
          client.end(true);
        } catch {}
      }
      resolve({
        success: false,
        brokerUrl,
        topic,
        error: `Ping roundtrip timed out after ${timeoutMs}ms (message echo not received). Check ACL permissions for pub/sub on this topic.`,
      });
    }, timeoutMs);

    try {
      client = mqtt.connect(brokerUrl, {
        clientId,
        username,
        password,
        protocolVersion: 5,
        connectTimeout: timeoutMs,
        reconnectPeriod: 0,
      });

      client.on('connect', () => {
        client.subscribe(topic, { qos: 0 }, (subErr) => {
          if (subErr) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            try {
              client.end(true);
            } catch {}
            resolve({
              success: false,
              brokerUrl,
              topic,
              error: `Subscribe failed: ${subErr.message}`,
            });
            return;
          }

          publishTimestamp = Date.now();
          const probePayload = JSON.stringify({
            nonce: probeNonce,
            timestamp: publishTimestamp,
            client: clientId,
          });

          client.publish(topic, probePayload, { qos: 0 }, (pubErr) => {
            if (pubErr) {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              try {
                client.end(true);
              } catch {}
              resolve({
                success: false,
                brokerUrl,
                topic,
                error: `Publish failed: ${pubErr.message}`,
              });
            }
          });
        });
      });

      client.on('message', (msgTopic, payloadBuffer) => {
        try {
          const data = JSON.parse(payloadBuffer.toString('utf8'));
          if (data && data.nonce === probeNonce) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            const rttMs = Date.now() - publishTimestamp;
            const totalElapsedMs = Date.now() - startTime;

            try {
              client.end(false);
            } catch {}

            resolve({
              success: true,
              status: 'ROUNDTRIP_PASSED',
              brokerUrl,
              topic,
              roundTripTimeMs: rttMs,
              totalTimeMs: totalElapsedMs,
              details: 'Successfully connected, subscribed, published, and received probe message.',
            });
          }
        } catch {}
      });

      client.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          client.end(true);
        } catch {}
        resolve({
          success: false,
          brokerUrl,
          topic,
          error: `Connection error: ${err.message}`,
        });
      });
    } catch (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        success: false,
        brokerUrl,
        error: err.message,
      });
    }
  });
}

const TOOLS = [
  {
    name: 'test_connection',
    description:
      'Test MQTT client connection, authentication, TLS/WSS handshake, and retrieve broker parameters and latency.',
    inputSchema: {
      type: 'object',
      properties: {
        brokerUrl: {
          type: 'string',
          description:
            'Broker URL (e.g., wss://host:8084/mqtt or mqtts://host:8883 or mqtt://localhost:1883). Defaults to project config.',
        },
        username: {
          type: 'string',
          description: 'MQTT client username (defaults to MQTT_GATEWAY_USERNAME).',
        },
        password: {
          type: 'string',
          description: 'MQTT client password (defaults to MQTT_GATEWAY_PASSWORD).',
        },
        clientId: {
          type: 'string',
          description: 'Custom MQTT Client ID (randomized default to avoid collisions).',
        },
        protocolVersion: {
          type: 'integer',
          enum: [4, 5],
          description: 'MQTT Protocol version (4 = 3.1.1, 5 = 5.0). Default: 5.',
        },
        timeoutMs: {
          type: 'integer',
          description: 'Connection timeout in milliseconds (default: 8000).',
        },
      },
    },
  },
  {
    name: 'publish_message',
    description: 'Publish an MQTT message to a topic with specified QoS and retain flags.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Target MQTT topic (e.g. melon/sensor-tanah/data-2424600050)',
        },
        payload: {
          type: 'string',
          description: 'Message payload (string or JSON string)',
        },
        qos: {
          type: 'integer',
          enum: [0, 1, 2],
          description: 'Quality of Service level (0, 1, 2). Default: 0.',
        },
        retain: {
          type: 'boolean',
          description: 'Whether the broker should retain the message. Default: false.',
        },
        brokerUrl: { type: 'string', description: 'Broker URL override' },
        username: { type: 'string', description: 'Username override' },
        password: { type: 'string', description: 'Password override' },
        clientId: { type: 'string', description: 'Client ID override' },
        timeoutMs: { type: 'integer', description: 'Timeout in ms (default: 8000)' },
      },
      required: ['topic', 'payload'],
    },
  },
  {
    name: 'subscribe_topic',
    description:
      'Subscribe to an MQTT topic and listen for incoming messages for a specified duration.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            'Target MQTT topic or wildcard (e.g. melon/+/data-2424600050 or melon/ai-tanah/#)',
        },
        qos: {
          type: 'integer',
          enum: [0, 1, 2],
          description: 'QoS level (default: 0)',
        },
        timeoutMs: {
          type: 'integer',
          description: 'Listening window duration in ms (default: 5000)',
        },
        maxMessages: {
          type: 'integer',
          description: 'Stop listening once N messages are received (default: 5)',
        },
        brokerUrl: { type: 'string', description: 'Broker URL override' },
        username: { type: 'string', description: 'Username override' },
        password: { type: 'string', description: 'Password override' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'ping_roundtrip',
    description:
      'Test end-to-end MQTT publish and subscribe roundtrip (loopback) to measure true roundtrip latency (RTT) and verify broker ACLs.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Probe topic to use for roundtrip test (default: auto-generated test topic)',
        },
        brokerUrl: { type: 'string', description: 'Broker URL override' },
        username: { type: 'string', description: 'Username override' },
        password: { type: 'string', description: 'Password override' },
        timeoutMs: { type: 'integer', description: 'Timeout in ms (default: 8000)' },
      },
    },
  },
];

async function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'test_connection': {
        const res = await testConnection(args);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'publish_message': {
        const res = await publishMessage(args);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'subscribe_topic': {
        const res = await subscribeTopic(args);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'ping_roundtrip': {
        const res = await pingRoundtrip(args);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool name: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
      isError: true,
    };
  }
}

function sendResponse(id, result = null, error = null) {
  if (id === null || id === undefined) return;
  const msg = { jsonrpc: '2.0', id };
  if (error) {
    msg.error = error;
  } else {
    msg.result = result;
  }
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'mqttx-mcp',
          version: '1.0.0',
        },
      });
      break;

    case 'notifications/initialized':
    case 'notifications/cancelled':
      break;

    case 'ping':
      sendResponse(id, {});
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call':
      if (!params || !params.name) {
        sendResponse(id, null, { code: -32602, message: 'Missing tool name parameter' });
        return;
      }
      handleToolCall(params.name, params.arguments || {})
        .then((res) => {
          sendResponse(id, res);
        })
        .catch((err) => {
          sendResponse(id, {
            content: [{ type: 'text', text: `Unhandled error: ${err.message}` }],
            isError: true,
          });
        });
      break;

    case 'prompts/list':
      sendResponse(id, { prompts: [] });
      break;

    case 'resources/list':
      sendResponse(id, { resources: [] });
      break;

    default:
      if (id !== undefined && id !== null) {
        sendResponse(id, null, {
          code: -32601,
          message: `Method not supported: ${method}`,
        });
      }
      break;
  }
}

function main() {
  log('Starting MQTTX MCP Server (MQTT 3.1.1 & 5.0)...');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      handleMessage(msg);
    } catch (err) {
      log('JSON Parse Error:', err.message);
    }
  });

  rl.on('close', () => {
    log('MQTTX MCP Server connection closed.');
    process.exit(0);
  });
}

main();
