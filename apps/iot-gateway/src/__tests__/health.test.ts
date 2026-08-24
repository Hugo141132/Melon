import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { validateGatewayEnv, GatewayEnv } from '../config/env';

describe('Gateway Health & Internal Readiness Endpoints', { timeout: 30000 }, () => {
  let env: GatewayEnv;

  beforeEach(() => {
    env = validateGatewayEnv({
      NODE_ENV: 'test',
      APP_ENV: 'test',
      PORT: '3001',
      INTERNAL_SERVICE_TOKEN: 'super_secret_internal_token_123',
    });
  });

  describe('Public Endpoints', () => {
    it('GET /health returns pass status independent of dependencies', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('pass');
      expect(json.service).toBe('iot-gateway');
    });

    it('GET /ready returns UP (200) when DB and MQTT are connected', async () => {
      const mockMqttClient: any = {
        getStatus: () => 'CONNECTED',
        isConnected: () => true,
      };

      const { app } = buildApp({
        env,
        mqttClient: mockMqttClient,
        dbChecker: async () => true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('UP');
      expect(json.database.connected).toBe(true);
      expect(json.mqtt.connected).toBe(true);
    });

    it('GET /ready returns DEGRADED (503) when MQTT is disconnected', async () => {
      const mockMqttClient: any = {
        getStatus: () => 'DISCONNECTED',
        isConnected: () => false,
      };

      const { app } = buildApp({
        env,
        mqttClient: mockMqttClient,
        dbChecker: async () => true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const json = response.json();
      expect(json.status).toBe('DEGRADED');
    });
  });

  describe('Internal Endpoints per API.md §23 & DEC-INF-078', () => {
    it('GET /internal/v1/health rejects requests without Bearer authorization', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/health',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /internal/v1/health rejects requests with wrong Bearer token', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/health',
        headers: {
          authorization: 'Bearer wrong_token_value',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /internal/v1/health returns { status: "ok" } with HTTP 200 when authenticated', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/health',
        headers: {
          authorization: 'Bearer super_secret_internal_token_123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('GET /internal/v1/ready rejects requests without Bearer authorization', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /internal/v1/ready rejects requests with wrong Bearer token', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
        headers: {
          authorization: 'Bearer wrong_token_value',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /internal/v1/ready and /health return 500 when INTERNAL_SERVICE_TOKEN is unset (fails safe)', async () => {
      const unconfiguredEnv = validateGatewayEnv({
        NODE_ENV: 'test',
        APP_ENV: 'test',
        PORT: '3001',
      });

      const { app } = buildApp({ env: unconfiguredEnv });

      const healthRes = await app.inject({
        method: 'GET',
        url: '/internal/v1/health',
        headers: {
          authorization: 'Bearer any_token',
        },
      });
      expect(healthRes.statusCode).toBe(500);
      expect(healthRes.json().error.code).toBe('INTERNAL_AUTH_NOT_CONFIGURED');

      const readyRes = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
        headers: {
          authorization: 'Bearer any_token',
        },
      });
      expect(readyRes.statusCode).toBe(500);
      expect(readyRes.json().error.code).toBe('INTERNAL_AUTH_NOT_CONFIGURED');
    });

    it('GET /internal/v1/ready returns canonical ready payload when authenticated and dependencies are up', async () => {
      const mockMqttClient: any = {
        getStatus: () => 'CONNECTED',
        isConnected: () => true,
      };

      const { app } = buildApp({
        env,
        mqttClient: mockMqttClient,
        dbChecker: async () => true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
        headers: {
          authorization: 'Bearer super_secret_internal_token_123',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toEqual({
        status: 'ready',
        dependencies: {
          database: 'up',
          broker: 'up',
        },
      });
      expect(JSON.stringify(json)).not.toContain('super_secret');
    });

    it('GET /internal/v1/ready returns degraded (503) when broker is down', async () => {
      const mockMqttClient: any = {
        getStatus: () => 'DISCONNECTED',
        isConnected: () => false,
      };

      const { app } = buildApp({
        env,
        mqttClient: mockMqttClient,
        dbChecker: async () => true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
        headers: {
          authorization: 'Bearer super_secret_internal_token_123',
        },
      });

      expect(response.statusCode).toBe(503);
      const json = response.json();
      expect(json).toEqual({
        status: 'degraded',
        dependencies: {
          database: 'up',
          broker: 'down',
        },
      });
    });

    it('GET /internal/v1/ready returns down (503) when database is down', async () => {
      const mockMqttClient: any = {
        getStatus: () => 'CONNECTED',
        isConnected: () => true,
      };

      const { app } = buildApp({
        env,
        mqttClient: mockMqttClient,
        dbChecker: async () => false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/internal/v1/ready',
        headers: {
          authorization: 'Bearer super_secret_internal_token_123',
        },
      });

      expect(response.statusCode).toBe(503);
      const json = response.json();
      expect(json).toEqual({
        status: 'down',
        dependencies: {
          database: 'down',
          broker: 'up',
        },
      });
    });
  });

  describe('Gateway Environment Validation Guard', () => {
    it('rejects missing INTERNAL_SERVICE_TOKEN in production', () => {
      expect(() =>
        validateGatewayEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          MQTT_BROKER_URL: 'wss://broker.example.com',
          MQTT_GATEWAY_CLIENT_ID: 'client_id',
          MQTT_GATEWAY_USERNAME: 'user',
          MQTT_GATEWAY_PASSWORD: 'password',
        })
      ).toThrowError(/INTERNAL_SERVICE_TOKEN is required in production/);
    });
  });
});
