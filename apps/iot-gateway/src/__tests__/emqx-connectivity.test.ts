import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { IClientOptions } from 'mqtt';
import { validateGatewayEnv } from '../config/env';
import { buildApp } from '../app';
import { GatewayMqttClient } from '../mqtt/client';
import { mqttTopicRouter } from '../mqtt/router';

// Mock EventEmitter simulating an MQTT client with TLS options capture
class MockEmqxClient extends EventEmitter {
  public connected: boolean = false;
  public capturedOptions: IClientOptions;

  constructor(options: IClientOptions) {
    super();
    this.capturedOptions = options;
  }

  public subscribe(_topic: string | string[], cb?: (err?: Error) => void) {
    if (cb) cb();
  }

  public publish(
    _topic: string,
    _message: string | Buffer,
    _opts?: any,
    cb?: (err?: Error) => void
  ) {
    if (cb) cb();
  }

  public end(_force?: boolean, _opts?: any, cb?: () => void) {
    this.connected = false;
    this.emit('close');
    if (cb) cb();
  }
}

describe('TASK-0914: Direct EMQX Cloud Connectivity & Isolation Controls', () => {
  let capturedOptions: IClientOptions | null = null;

  const mockFactory = (options: IClientOptions) => {
    capturedOptions = options;
    return new MockEmqxClient(options) as any;
  };

  beforeEach(() => {
    capturedOptions = null;
  });

  describe('1. EMQX Cloud TLS Connection & Security Options', () => {
    it('configures GatewayMqttClient with strict TLS validation (rejectUnauthorized: true) for mqtts://', async () => {
      const env = validateGatewayEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        MQTT_BROKER_URL: 'mqtts://dev-cluster.emqxsl.com:8883',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-dev-local-01',
        MQTT_GATEWAY_USERNAME: 'gateway_dev_user',
        MQTT_GATEWAY_PASSWORD: 'gateway_dev_password_123',
      });

      const client = new GatewayMqttClient(env, mockFactory);
      await client.connect();

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.clientId).toBe('gateway-kebun-melon-dev-local-01');
      expect(capturedOptions?.username).toBe('gateway_dev_user');
      expect(capturedOptions?.password).toBe('gateway_dev_password_123');
      expect(capturedOptions?.rejectUnauthorized).toBe(true);
      expect(capturedOptions?.clean).toBe(true);
      expect(capturedOptions?.reconnectPeriod).toBe(2000);

      await client.disconnect();
    });

    it('configures GatewayMqttClient for EMQX Cloud secure WebSocket (wss://)', async () => {
      const env = validateGatewayEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        MQTT_BROKER_URL: 'wss://dev-cluster.emqxsl.com:8084/mqtt',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-dev-local-02',
        MQTT_GATEWAY_USERNAME: 'gateway_dev_user_ws',
        MQTT_GATEWAY_PASSWORD: 'gateway_dev_password_ws',
      });

      const client = new GatewayMqttClient(env, mockFactory);
      await client.connect();

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.clientId).toBe('gateway-kebun-melon-dev-local-02');
      expect(capturedOptions?.rejectUnauthorized).toBe(true);

      await client.disconnect();
    });

    it('redacts sensitive credentials from connection error logs', async () => {
      const env = validateGatewayEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        MQTT_BROKER_URL: 'mqtts://dev-cluster.emqxsl.com:8883',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-dev-local-01',
      });

      let mockClientInstance: MockEmqxClient | null = null;
      const client = new GatewayMqttClient(env, (opts) => {
        mockClientInstance = new MockEmqxClient(opts);
        return mockClientInstance as any;
      });

      await client.connect();
      expect(client.getStatus()).toBe('CONNECTING');

      // Simulate TLS error containing a sensitive password string
      mockClientInstance!.emit(
        'error',
        new Error('TLS Handshake Failed for password secret_emqx_token_998877')
      );

      expect(client.getStatus()).toBe('ERROR');
      const lastErr = client.getLastError();
      expect(lastErr).not.toContain('secret_emqx_token_998877');
      expect(lastErr).toContain('password=[REDACTED]');

      await client.disconnect();
    });
  });

  describe('2. Client ID Collision Avoidance', () => {
    it('ensures local development and staging have distinct client IDs', () => {
      const devEnv = validateGatewayEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-dev-local-01',
      });

      const stagingEnv = validateGatewayEnv({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        MQTT_BROKER_URL: 'mqtts://cluster.emqxsl.com:8883',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-staging-01',
        MQTT_GATEWAY_USERNAME: 'gw-staging',
        MQTT_GATEWAY_PASSWORD: 'gw-staging-pass',
        INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
      });

      expect(devEnv.MQTT_GATEWAY_CLIENT_ID).not.toBe(stagingEnv.MQTT_GATEWAY_CLIENT_ID);
      expect(devEnv.MQTT_GATEWAY_CLIENT_ID).toContain('dev-local');
      expect(stagingEnv.MQTT_GATEWAY_CLIENT_ID).toContain('staging');
    });
  });

  describe('3. Development vs Staging Topic Namespace Isolation', () => {
    it('generates isolated subscription patterns for development and staging', () => {
      const devPattern = mqttTopicRouter.getCategorySubscriptionPattern(
        'development',
        'telemetry',
        'reservoir'
      );
      const stagingPattern = mqttTopicRouter.getCategorySubscriptionPattern(
        'staging',
        'telemetry',
        'reservoir'
      );

      expect(devPattern).toBe('agriculture/development/+/+/telemetry/reservoir');
      expect(stagingPattern).toBe('agriculture/staging/+/+/telemetry/reservoir');
      expect(devPattern).not.toBe(stagingPattern);
    });

    it('rejects cross-environment telemetry topics when expectedEnv is enforced', () => {
      // Local dev gateway expecting development topics should reject staging messages
      const stagingTopic = 'agriculture/staging/site-01/water-tank-node-zi37gz/telemetry/reservoir';
      const resultForDevGateway = mqttTopicRouter.validateTopic(stagingTopic, 'development');
      expect(resultForDevGateway.valid).toBe(false);
      expect(resultForDevGateway.error).toContain('Environment mismatch');

      // Valid development topic should pass
      const devTopic = 'agriculture/development/site-01/water-tank-node-zi37gz/telemetry/reservoir';
      const resultForDev = mqttTopicRouter.validateTopic(devTopic, 'development');
      expect(resultForDev.valid).toBe(true);
      expect(resultForDev.parsed?.environment).toBe('development');
    });
  });

  describe('4. Fastify Readiness with EMQX Broker State Transitions', () => {
    it('transitions /ready between 503 (DEGRADED/DOWN) and 200 (UP) with EMQX client lifecycle', async () => {
      const env = validateGatewayEnv({
        NODE_ENV: 'test',
        MQTT_BROKER_URL: 'mqtts://dev-cluster.emqxsl.com:8883',
        MQTT_GATEWAY_CLIENT_ID: 'gateway-kebun-melon-dev-local-01',
      });

      let mockEmitter: MockEmqxClient;
      const mqttClient = new GatewayMqttClient(env, (opts) => {
        mockEmitter = new MockEmqxClient(opts);
        return mockEmitter as any;
      });

      const { app } = buildApp({
        env,
        mqttClient,
        dbChecker: async () => true,
      });

      try {
        // Initial state before connect: DEGRADED (503)
        const initialRes = await app.inject({ method: 'GET', url: '/ready' });
        expect(initialRes.statusCode).toBe(503);
        expect(initialRes.json().mqtt.status).toBe('DISCONNECTED');

        // Connect
        const connectPromise = mqttClient.connect();
        mockEmitter!.connected = true;
        mockEmitter!.emit('connect');
        await connectPromise;

        // Connected state: UP (200)
        const upRes = await app.inject({ method: 'GET', url: '/ready' });
        expect(upRes.statusCode).toBe(200);
        expect(upRes.json().status).toBe('UP');
        expect(upRes.json().mqtt.status).toBe('CONNECTED');

        // Broker disconnects: DEGRADED (503)
        mockEmitter!.emit('offline');
        const offlineRes = await app.inject({ method: 'GET', url: '/ready' });
        expect(offlineRes.statusCode).toBe(503);
        expect(offlineRes.json().status).toBe('DEGRADED');
        expect(offlineRes.json().mqtt.status).toBe('DISCONNECTED');
      } finally {
        await app.close();
        await mqttClient.disconnect();
      }
    });
  });
});
