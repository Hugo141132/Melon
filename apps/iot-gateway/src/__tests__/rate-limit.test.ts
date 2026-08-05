import { describe, it, expect, beforeEach } from 'vitest';
import { validateGatewayEnv } from '../config/env';
import { buildApp, clearGatewayRateLimitStore } from '../app';

describe('TASK-0902 — IoT Gateway Rate Limiting Integration Tests', () => {
  beforeEach(() => {
    clearGatewayRateLimitStore();
  });

  it('includes rate limit response headers on gateway HTTP requests', async () => {
    const env = validateGatewayEnv({
      NODE_ENV: 'test',
      APP_ENV: 'development',
      PORT: '3001',
      RATE_LIMIT_GATEWAY_MAX: '5',
    });

    const { app } = buildApp({ env });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('4');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('enforces HTTP 429 and Retry-After header when gateway rate limit is exceeded', async () => {
    const env = validateGatewayEnv({
      NODE_ENV: 'test',
      APP_ENV: 'development',
      PORT: '3001',
      RATE_LIMIT_GATEWAY_MAX: '3',
    });

    const { app } = buildApp({ env });

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({ method: 'GET', url: '/health' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['x-ratelimit-limit']).toBe('3');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['retry-after']).toBeDefined();

    const payload = JSON.parse(blocked.payload);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
