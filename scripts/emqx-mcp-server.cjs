#!/usr/bin/env node

/**
 * EMQX Cloud / Self-Hosted Model Context Protocol (MCP) Server
 * Standard JSON-RPC 2.0 stdio server with zero external runtime dependencies.
 */

const https = require('https');
const http = require('http');
const readline = require('readline');
const { URL } = require('url');

const EMQX_API_URL = (process.env.EMQX_API_URL || '').replace(/\/+$/, '');
const EMQX_API_KEY = process.env.EMQX_API_KEY || '';
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || '';

function log(...args) {
  process.stderr.write(`[EMQX-MCP] ${args.join(' ')}\n`);
}

function requestEMQX(endpointPath, method = 'GET', bodyData = null) {
  return new Promise((resolve, reject) => {
    if (!EMQX_API_URL || !EMQX_API_KEY || !EMQX_API_SECRET) {
      return reject(
        new Error('Missing EMQX_API_URL, EMQX_API_KEY, or EMQX_API_SECRET environment variables.')
      );
    }

    try {
      const fullUrl = new URL(
        endpointPath.startsWith('http')
          ? endpointPath
          : `${EMQX_API_URL}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`
      );
      const isHttps = fullUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const authHeader =
        'Basic ' + Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');
      const headers = {
        Authorization: authHeader,
        Accept: 'application/json',
      };

      let payload = null;
      if (bodyData !== null && bodyData !== undefined) {
        payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = client.request(
        fullUrl,
        {
          method: method.toUpperCase(),
          headers: headers,
          timeout: 10000,
        },
        (res) => {
          let resBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            resBody += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = resBody ? JSON.parse(resBody) : null;
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ status: res.statusCode, data: parsed || { success: true } });
              } else {
                resolve({
                  status: res.statusCode,
                  error:
                    parsed && (parsed.message || parsed.code)
                      ? parsed
                      : resBody || `HTTP ${res.statusCode}`,
                });
              }
            } catch {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ status: res.statusCode, data: resBody });
              } else {
                resolve({ status: res.statusCode, error: resBody || `HTTP ${res.statusCode}` });
              }
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request to EMQX Cloud API timed out (10s limit).'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

const TOOLS = [
  {
    name: 'list_clients',
    description:
      'List MQTT clients connected or registered to the EMQX broker with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Page number (default: 1)' },
        limit: { type: 'integer', description: 'Page size limit (default: 50, max: 1000)' },
        clientid: { type: 'string', description: 'Filter by client ID substring or exact match' },
        username: { type: 'string', description: 'Filter by username' },
        conn_state: {
          type: 'string',
          enum: ['connected', 'disconnected'],
          description: 'Filter by connection state',
        },
        ip_address: { type: 'string', description: 'Filter by client IP address' },
      },
    },
  },
  {
    name: 'get_client',
    description: 'Get detailed information about a specific MQTT client by its Client ID.',
    inputSchema: {
      type: 'object',
      properties: {
        clientid: { type: 'string', description: 'Exact Client ID of the MQTT client' },
      },
      required: ['clientid'],
    },
  },
  {
    name: 'disconnect_client',
    description: 'Kick or disconnect a connected MQTT client by its Client ID.',
    inputSchema: {
      type: 'object',
      properties: {
        clientid: {
          type: 'string',
          description: 'Exact Client ID of the MQTT client to disconnect',
        },
      },
      required: ['clientid'],
    },
  },
  {
    name: 'publish_message',
    description: 'Publish an MQTT message to a topic via EMQX REST API.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Target MQTT topic (e.g., melon/controls/tank-01)' },
        payload: { type: 'string', description: 'Message payload (string or stringified JSON)' },
        qos: { type: 'integer', enum: [0, 1, 2], description: 'Quality of Service (default: 0)' },
        retain: {
          type: 'boolean',
          description: 'Whether the message should be retained by the broker',
        },
        clientid: {
          type: 'string',
          description: 'Optional simulated client ID for publisher identification',
        },
      },
      required: ['topic', 'payload'],
    },
  },
  {
    name: 'publish_bulk_messages',
    description: 'Publish multiple MQTT messages in a single batch request.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              payload: { type: 'string' },
              qos: { type: 'integer', enum: [0, 1, 2] },
              retain: { type: 'boolean' },
              clientid: { type: 'string' },
            },
            required: ['topic', 'payload'],
          },
          description: 'List of messages to publish',
        },
      },
      required: ['messages'],
    },
  },
  {
    name: 'list_subscriptions',
    description: 'List active MQTT topic subscriptions across clients.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Page number (default: 1)' },
        limit: { type: 'integer', description: 'Page size limit (default: 50)' },
        clientid: { type: 'string', description: 'Filter subscriptions for a specific client ID' },
        topic: { type: 'string', description: 'Filter subscriptions for a specific topic' },
        qos: { type: 'integer', enum: [0, 1, 2], description: 'Filter by QoS level' },
      },
    },
  },
  {
    name: 'list_topics',
    description: 'List routing topics currently known to the broker.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Page number (default: 1)' },
        limit: { type: 'integer', description: 'Page size limit (default: 50)' },
        topic: { type: 'string', description: 'Filter topic string' },
      },
    },
  },
  {
    name: 'get_client_subscriptions',
    description: 'Get all active topic subscriptions for a specific MQTT client.',
    inputSchema: {
      type: 'object',
      properties: {
        clientid: { type: 'string', description: 'Client ID of the MQTT client' },
      },
      required: ['clientid'],
    },
  },
  {
    name: 'unsubscribe_client_topic',
    description: 'Unsubscribe a specific MQTT client from a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        clientid: { type: 'string', description: 'Client ID of the MQTT client' },
        topic: { type: 'string', description: 'Topic to unsubscribe from' },
      },
      required: ['clientid', 'topic'],
    },
  },
];

async function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'list_clients': {
        const queryParams = new URLSearchParams();
        if (args.page) queryParams.set('page', String(args.page));
        if (args.limit) queryParams.set('limit', String(args.limit));
        if (args.clientid) queryParams.set('clientid', args.clientid);
        if (args.username) queryParams.set('username', args.username);
        if (args.conn_state) queryParams.set('conn_state', args.conn_state);
        if (args.ip_address) queryParams.set('ip_address', args.ip_address);
        const qs = queryParams.toString();
        const res = await requestEMQX(`/clients${qs ? '?' + qs : ''}`, 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'get_client': {
        const encoded = encodeURIComponent(args.clientid);
        const res = await requestEMQX(`/clients/${encoded}`, 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'disconnect_client': {
        const encoded = encodeURIComponent(args.clientid);
        const res = await requestEMQX(`/clients/${encoded}`, 'DELETE');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'publish_message': {
        const payload = {
          topic: args.topic,
          payload: args.payload,
          qos: args.qos ?? 0,
          retain: args.retain ?? false,
        };
        if (args.clientid) payload.clientid = args.clientid;
        const res = await requestEMQX('/publish', 'POST', payload);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'publish_bulk_messages': {
        const payload = (args.messages || []).map((m) => ({
          topic: m.topic,
          payload: m.payload,
          qos: m.qos ?? 0,
          retain: m.retain ?? false,
          ...(m.clientid ? { clientid: m.clientid } : {}),
        }));
        const res = await requestEMQX('/publish/bulk', 'POST', payload);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'list_subscriptions': {
        const queryParams = new URLSearchParams();
        if (args.page) queryParams.set('page', String(args.page));
        if (args.limit) queryParams.set('limit', String(args.limit));
        if (args.clientid) queryParams.set('clientid', args.clientid);
        if (args.topic) queryParams.set('topic', args.topic);
        if (args.qos !== undefined) queryParams.set('qos', String(args.qos));
        const qs = queryParams.toString();
        const res = await requestEMQX(`/subscriptions${qs ? '?' + qs : ''}`, 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'list_topics': {
        const queryParams = new URLSearchParams();
        if (args.page) queryParams.set('page', String(args.page));
        if (args.limit) queryParams.set('limit', String(args.limit));
        if (args.topic) queryParams.set('topic', args.topic);
        const qs = queryParams.toString();
        const res = await requestEMQX(`/topics${qs ? '?' + qs : ''}`, 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'get_client_subscriptions': {
        const encoded = encodeURIComponent(args.clientid);
        const res = await requestEMQX(`/clients/${encoded}/subscriptions`, 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'unsubscribe_client_topic': {
        const encodedClient = encodeURIComponent(args.clientid);
        const encodedTopic = encodeURIComponent(args.topic);
        const res = await requestEMQX(
          `/clients/${encodedClient}/subscriptions/${encodedTopic}`,
          'DELETE'
        );
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
          name: 'emqx-cloud-mcp',
          version: '1.0.0',
        },
      });
      break;

    case 'notifications/initialized':
    case 'notifications/cancelled':
      // No-op for standard notifications
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

    case 'resources/templates/list':
      sendResponse(id, { resourceTemplates: [] });
      break;

    default:
      if (id !== undefined && id !== null) {
        // Return empty result or method not found without crashing
        sendResponse(id, null, {
          code: -32601,
          message: `Method not supported: ${method}`,
        });
      }
      break;
  }
}

function main() {
  log('Starting EMQX Cloud MCP Server...');
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
    log('EMQX MCP Server connection closed.');
    process.exit(0);
  });
}

main();
