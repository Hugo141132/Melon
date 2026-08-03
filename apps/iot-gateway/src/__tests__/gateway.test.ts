import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { validateGatewayEnv, redactSecrets, loadGatewayDotenv } from '../config/env';
import { buildApp } from '../app';
import { GatewayMqttClient } from '../mqtt/client';

// Mock EventEmitter representing an MQTT client
class MockMqttClient extends EventEmitter {
  public connected: boolean = false;

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

describe('TASK-0401 — IoT Gateway Service', () => {
  describe('Environment Config Validation & Secret Redaction', () => {
    it('validates default development environment variables', () => {
      const config = validateGatewayEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
      });

      expect(config.NODE_ENV).toBe('development');
      expect(config.APP_ENV).toBe('development');
      expect(config.PORT).toBe(3001);
      expect(config.HOST).toBe('0.0.0.0');
      expect(config.ENABLE_FAUCET_CONTROL).toBe(false);
    });

    it('rejects incomplete production environment variables', () => {
      expect(() =>
        validateGatewayEnv({
          NODE_ENV: 'production',
          MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
        })
      ).toThrowError(/MQTT_GATEWAY_CLIENT_ID/);
    });

    it('rejects insecure broker scheme in production', () => {
      expect(() =>
        validateGatewayEnv({
          NODE_ENV: 'production',
          MQTT_BROKER_URL: 'mqtt://broker.example.com:1883',
          MQTT_GATEWAY_CLIENT_ID: 'gateway-01',
          MQTT_GATEWAY_USERNAME: 'gw-user',
          MQTT_GATEWAY_PASSWORD: 'secretpassword',
        })
      ).toThrowError(/must use a secure scheme/);
    });

    it('rejects ENABLE_FAUCET_CONTROL=true in production', () => {
      expect(() =>
        validateGatewayEnv({
          NODE_ENV: 'production',
          MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
          MQTT_GATEWAY_CLIENT_ID: 'gateway-01',
          MQTT_GATEWAY_USERNAME: 'gw-user',
          MQTT_GATEWAY_PASSWORD: 'secretpassword',
          ENABLE_FAUCET_CONTROL: 'true',
        })
      ).toThrowError(/ENABLE_FAUCET_CONTROL=true is rejected in production/);
    });

    it('redacts sensitive passwords, tokens, and DB connection strings', () => {
      const input = {
        MQTT_GATEWAY_PASSWORD: 'supersecretpassword123',
        DATABASE_URL: 'postgresql://postgres:mysecretpass@localhost:5432/kebun_melon',
        normalField: 'public_value',
      };

      const redacted = redactSecrets(input);

      expect(redacted.MQTT_GATEWAY_PASSWORD).toBe('[REDACTED]');
      expect(redacted.DATABASE_URL).toBe('postgresql://postgres:***@localhost:5432/kebun_melon');
      expect(redacted.normalField).toBe('public_value');
    });

    it('executes loadGatewayDotenv without throwing errors', () => {
      expect(() => loadGatewayDotenv()).not.toThrow();
    });
  });

  describe('Fastify Health & Readiness Routes', () => {
    let env: ReturnType<typeof validateGatewayEnv>;

    beforeEach(() => {
      env = validateGatewayEnv({
        NODE_ENV: 'test',
        PORT: '3001',
      });
    });

    it('GET /health returns pass status and uptime without secrets', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.status).toBe('pass');
      expect(payload.service).toBe('iot-gateway');
      expect(typeof payload.uptime).toBe('number');
      expect(payload.timestamp).toBeDefined();
      expect(JSON.stringify(payload)).not.toContain('password');
      expect(JSON.stringify(payload)).not.toContain('secret');
    });

    it('GET /ready reflects DEGRADED with 503 when DB is connected but MQTT is disconnected', async () => {
      const { app } = buildApp({
        env,
        dbChecker: async () => true, // DB connected
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const payload = response.json();
      expect(payload.status).toBe('DEGRADED');
      expect(payload.service).toBe('iot-gateway');
      expect(payload.database.status).toBe('CONNECTED');
      expect(payload.database.connected).toBe(true);
      expect(payload.mqtt.status).toBe('DISCONNECTED');
      expect(payload.mqtt.connected).toBe(false);
    });

    it('GET /ready reflects DOWN with 503 when DB is unreachable', async () => {
      const { app } = buildApp({
        env,
        dbChecker: async () => false, // DB unreachable
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const payload = response.json();
      expect(payload.status).toBe('DOWN');
      expect(payload.database.status).toBe('DISCONNECTED');
      expect(payload.database.connected).toBe(false);
    });

    it('GET /ready reflects UP with 200 when both DB and MQTT are connected', async () => {
      const mockEventEmitter = new MockMqttClient();
      const mockClient = new GatewayMqttClient(env, () => mockEventEmitter as any);

      const { app } = buildApp({
        env,
        mqttClient: mockClient,
        dbChecker: async () => true, // DB connected
      });

      const connectPromise = mockClient.connect();
      mockEventEmitter.connected = true;
      mockEventEmitter.emit('connect');
      await connectPromise;

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.status).toBe('UP');
      expect(payload.database.status).toBe('CONNECTED');
      expect(payload.database.connected).toBe(true);
      expect(payload.mqtt.status).toBe('CONNECTED');
      expect(payload.mqtt.connected).toBe(true);
    });
  });

  describe('MQTT Client Lifecycle (Connect, Disconnect, Reconnect)', () => {
    let env: ReturnType<typeof validateGatewayEnv>;

    beforeEach(() => {
      env = validateGatewayEnv({
        NODE_ENV: 'test',
        MQTT_BROKER_URL: 'mqtt://localhost:1883',
      });
    });

    it('handles connect, reconnect, error, and graceful disconnect transitions', async () => {
      const mockEmitter = new MockMqttClient();
      const client = new GatewayMqttClient(env, () => mockEmitter as any);

      expect(client.getStatus()).toBe('DISCONNECTED');
      expect(client.isConnected()).toBe(false);

      const connectPromise = client.connect();
      expect(client.getStatus()).toBe('CONNECTING');

      // Simulate connection success
      mockEmitter.connected = true;
      mockEmitter.emit('connect');
      await connectPromise;

      expect(client.getStatus()).toBe('CONNECTED');
      expect(client.isConnected()).toBe(true);

      // Simulate reconnect event
      mockEmitter.emit('reconnect');
      expect(client.getStatus()).toBe('RECONNECTING');

      // Simulate error event (with sensitive password message)
      mockEmitter.emit('error', new Error('Auth failed for password secretpass'));
      expect(client.getStatus()).toBe('ERROR');
      expect(client.getLastError()).not.toContain('secretpass');
      expect(client.getLastError()).toContain('[REDACTED]');

      // Simulate graceful disconnect
      await client.disconnect();
      expect(client.getStatus()).toBe('DISCONNECTED');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Graceful Service Shutdown', () => {
    it('closes Fastify server and MQTT client without errors', async () => {
      const env = validateGatewayEnv({ NODE_ENV: 'test' });
      const mockEmitter = new MockMqttClient();
      const mockMqttClient = new GatewayMqttClient(env, () => mockEmitter as any);

      const { app, mqttClient } = buildApp({ env, mqttClient: mockMqttClient });

      const spyAppClose = vi.spyOn(app, 'close');
      const spyMqttDisconnect = vi.spyOn(mqttClient, 'disconnect');

      await app.close();
      await mqttClient.disconnect();

      expect(spyAppClose).toHaveBeenCalled();
      expect(spyMqttDisconnect).toHaveBeenCalled();
      expect(mqttClient.getStatus()).toBe('DISCONNECTED');
    });
  });
});
