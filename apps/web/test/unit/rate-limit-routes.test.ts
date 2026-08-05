import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearRateLimitStore } from '../../lib/rate-limit';
import { POST as loginPOST } from '../../app/api/v1/auth/login/route';
import { POST as registerPOST } from '../../app/api/v1/auth/register/route';

describe('Rate Limiting API Routes Integration (TASK-0902)', () => {
  const origLoginMax = process.env.RATE_LIMIT_LOGIN_MAX;
  const origRegisterMax = process.env.RATE_LIMIT_REGISTER_MAX;

  beforeEach(() => {
    clearRateLimitStore();
    process.env.RATE_LIMIT_LOGIN_MAX = '5';
    process.env.RATE_LIMIT_REGISTER_MAX = '3';
  });

  afterEach(() => {
    if (origLoginMax !== undefined) process.env.RATE_LIMIT_LOGIN_MAX = origLoginMax;
    else delete process.env.RATE_LIMIT_LOGIN_MAX;

    if (origRegisterMax !== undefined) process.env.RATE_LIMIT_REGISTER_MAX = origRegisterMax;
    else delete process.env.RATE_LIMIT_REGISTER_MAX;
  });

  it('enforces rate limiting on POST /api/v1/auth/login returning 429 when max limit exceeded', async () => {
    const makeReq = () =>
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.50',
        },
        body: JSON.stringify({ email: 'user@example.com', password: 'Password123!' }),
      });

    // Send 5 requests (configured RATE_LIMIT_LOGIN_MAX = 5)
    for (let i = 0; i < 5; i++) {
      const res = await loginPOST(makeReq());
      expect(res.status).not.toBe(429);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    }

    // 6th request should be rate-limited (HTTP 429)
    const blockedRes = await loginPOST(makeReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();

    const json = await blockedRes.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('regression test: returns 400 VALIDATION_ERROR with rate-limit headers on invalid body rather than 500, then 429 after limit', async () => {
    const makeBadReq = () =>
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.99',
        },
        body: '{ malformed_json: ',
      });

    // Requests 1–5 with bad payload should return 400 VALIDATION_ERROR (not 500) and preserve rate limit headers
    for (let i = 0; i < 5; i++) {
      const res = await loginPOST(makeBadReq());
      expect(res.status).toBe(400);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe(String(4 - i));
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    }

    // Requests 6–7 should return 429 TOO_MANY_REQUESTS
    const blockedRes = await loginPOST(makeBadReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    const blockedJson = await blockedRes.json();
    expect(blockedJson.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('enforces rate limiting on POST /api/v1/auth/register returning 429 when max limit exceeded', async () => {
    const makeReq = () =>
      new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.51',
        },
        body: JSON.stringify({
          fullName: 'Test Admin',
          email: 'admin@example.com',
          password: 'Password123!',
        }),
      });

    // Send 3 requests (configured RATE_LIMIT_REGISTER_MAX = 3)
    for (let i = 0; i < 3; i++) {
      const res = await registerPOST(makeReq());
      expect(res.status).not.toBe(429);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    }

    // 4th request should be rate-limited (HTTP 429)
    const blockedRes = await registerPOST(makeReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();

    const json = await blockedRes.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
