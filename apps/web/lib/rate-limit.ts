import { NextResponse } from 'next/server';

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // POSIX timestamp in ms
  retryAfterSeconds: number; // seconds
}

interface WindowEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting state across API routes
const store = new Map<string, WindowEntry>();

/**
 * Reset memory store (primarily for unit/integration tests).
 */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Check and consume a rate limit token for a given key.
 */
export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitInfo {
  const now = Date.now();
  const key = `${options.keyPrefix}:${identifier}`;
  let entry = store.get(key);

  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    store.set(key, entry);
  } else {
    entry.count += 1;
  }

  const allowed = entry.count <= options.limit;
  const remaining = Math.max(0, options.limit - entry.count);
  const retryAfterMs = Math.max(0, entry.resetTime - now);
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  return {
    allowed,
    limit: options.limit,
    remaining,
    resetTime: entry.resetTime,
    retryAfterSeconds,
  };
}

/**
 * Extract client IP address from request headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Apply X-RateLimit-* headers to a Headers instance.
 */
export function applyRateLimitHeaders(headers: Headers, info: RateLimitInfo): void {
  headers.set('X-RateLimit-Limit', String(info.limit));
  headers.set('X-RateLimit-Remaining', String(Math.max(0, info.remaining)));
  headers.set('X-RateLimit-Reset', String(Math.ceil(info.resetTime / 1000)));

  if (!info.allowed) {
    headers.set('Retry-After', String(Math.max(1, info.retryAfterSeconds)));
  }
}

/**
 * Create standard HTTP 429 Too Many Requests response envelope.
 */
export function createRateLimitResponse(info: RateLimitInfo, requestId?: string): NextResponse {
  const body: Record<string, any> = {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please try again later.',
    },
  };
  if (requestId) {
    body.meta = { requestId };
  }

  const response = NextResponse.json(body, { status: 429 });
  applyRateLimitHeaders(response.headers, info);
  return response;
}

/**
 * Apply rate limit headers to an existing NextResponse object.
 */
export function applyRateLimitToResponse(
  response: NextResponse,
  info: RateLimitInfo
): NextResponse {
  applyRateLimitHeaders(response.headers, info);
  return response;
}
