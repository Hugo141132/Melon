import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  clearRateLimitStore,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitHeaders,
} from '../../lib/rate-limit';

describe('Rate Limiter Module (TASK-0902)', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it('allows requests within limit and decrements remaining tokens', () => {
    const opts = { keyPrefix: 'test', limit: 3, windowMs: 60000 };

    const r1 = checkRateLimit('user1', opts);
    expect(r1.allowed).toBe(true);
    expect(r1.limit).toBe(3);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit('user1', opts);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit('user1', opts);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests exceeding limit and provides Retry-After seconds', () => {
    const opts = { keyPrefix: 'test', limit: 2, windowMs: 60000 };

    checkRateLimit('ip1', opts);
    checkRateLimit('ip1', opts);

    const blocked = checkRateLimit('ip1', opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('isolates rate limit states across key prefixes and identifiers', () => {
    const opts1 = { keyPrefix: 'login', limit: 2, windowMs: 60000 };
    const opts2 = { keyPrefix: 'register', limit: 2, windowMs: 60000 };

    checkRateLimit('127.0.0.1', opts1);
    checkRateLimit('127.0.0.1', opts1);

    // Login prefix blocked for 127.0.0.1
    expect(checkRateLimit('127.0.0.1', opts1).allowed).toBe(false);

    // Register prefix allowed for 127.0.0.1
    expect(checkRateLimit('127.0.0.1', opts2).allowed).toBe(true);

    // Login prefix allowed for another IP
    expect(checkRateLimit('192.168.1.1', opts1).allowed).toBe(true);
  });

  it('extracts IP correctly from X-Forwarded-For and X-Real-IP headers', () => {
    const req1 = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    });
    expect(getClientIp(req1)).toBe('203.0.113.195');

    const req2 = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.1' },
    });
    expect(getClientIp(req2)).toBe('198.51.100.1');

    const req3 = new Request('http://localhost');
    expect(getClientIp(req3)).toBe('127.0.0.1');
  });

  it('creates structured 429 response envelope with Retry-After and X-RateLimit headers', async () => {
    const info = {
      allowed: false,
      limit: 5,
      remaining: 0,
      resetTime: Date.now() + 30000,
      retryAfterSeconds: 30,
    };

    const res = createRateLimitResponse(info, 'req-test-123');
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TOO_MANY_REQUESTS');
    expect(json.error.message).toContain('Too many requests');
    expect(json.meta.requestId).toBe('req-test-123');
  });

  it('applies X-RateLimit headers to allowed responses', () => {
    const info = {
      allowed: true,
      limit: 10,
      remaining: 8,
      resetTime: Date.now() + 60000,
      retryAfterSeconds: 60,
    };

    const headers = new Headers();
    applyRateLimitHeaders(headers, info);

    expect(headers.get('X-RateLimit-Limit')).toBe('10');
    expect(headers.get('X-RateLimit-Remaining')).toBe('8');
    expect(headers.get('X-RateLimit-Reset')).toBeDefined();
    expect(headers.get('Retry-After')).toBeNull();
  });
});
