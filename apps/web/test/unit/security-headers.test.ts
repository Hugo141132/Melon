import { describe, it, expect } from 'vitest';

describe('TASK-0901 — Web Security Headers Configuration Tests', () => {
  it('returns required security headers for all routes in non-production environment', async () => {
    // Dynamically import next.config.mjs
    const nextConfigModule = await import('../../next.config.mjs');
    const nextConfig = nextConfigModule.default;

    expect(typeof nextConfig.headers).toBe('function');
    const headerRules = await nextConfig.headers();

    expect(headerRules).toHaveLength(1);
    expect(headerRules[0].source).toBe('/:path*');

    const headersMap = new Map(
      headerRules[0].headers.map((h: { key: string; value: string }) => [h.key, h.value])
    );

    expect(headersMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headersMap.get('X-Frame-Options')).toBe('DENY');
    expect(headersMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headersMap.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    expect(headersMap.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(headersMap.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(headersMap.get('Content-Security-Policy')).toContain('https://fonts.googleapis.com');
    expect(headersMap.get('Content-Security-Policy')).toContain('https://fonts.gstatic.com');
    expect(headersMap.get('Strict-Transport-Security')).toBeUndefined();
  });
});
