import { describe, it, expect, beforeEach } from 'vitest';
import { validateGatewayEnv } from '../config/env';
import { buildApp } from '../app';

describe('TASK-0901 — IoT Gateway Security Headers Integration Tests', () => {
  let envDev: ReturnType<typeof validateGatewayEnv>;

  beforeEach(() => {
    envDev = validateGatewayEnv({
      NODE_ENV: 'test',
      APP_ENV: 'development',
      PORT: '3001',
    });
  });

  it('returns required security headers on HTTP response in development/test environment', async () => {
    const { app } = buildApp({ env: envDev });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
    );
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('returns Strict-Transport-Security header in production environment', async () => {
    const envProd = validateGatewayEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
      MQTT_GATEWAY_CLIENT_ID: 'gateway-prod-01',
      MQTT_GATEWAY_USERNAME: 'gw-user-prod',
      MQTT_GATEWAY_PASSWORD: 'secretpassword123',
      INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
    });

    const { app } = buildApp({ env: envProd });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
  });

  it('rejects request with 400 Bad Request when header contains tab character (GHSA-jx2c-rxcm-jvmq workaround)', async () => {
    const { app } = buildApp({ env: envDev });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'content-type': 'application/json;\tcharset=utf-8',
      },
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.payload);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_HEADER');
  });
});
