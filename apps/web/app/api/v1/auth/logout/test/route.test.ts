import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';

let mockCookieValue: string | undefined = 'test-cookie-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieValue ? { value: mockCookieValue } : undefined,
  }),
}));

describe('POST /api/v1/auth/logout Route Handler Unit Tests', () => {
  beforeEach(() => {
    mockCookieValue = 'test-cookie-token';
    vi.restoreAllMocks();
  });

  it('1. Returns 204 No Content with no response body and clears session_token cookie via cookies() store', async () => {
    const revokeSpy = vi.spyOn(dbModule, 'revokeSession').mockResolvedValueOnce(true);

    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(204);

    const bodyText = await res.text();
    expect(bodyText).toBe('');

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('session_token=;');
    expect(setCookie).toContain('Max-Age=0');
    expect(revokeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'test-cookie-token',
      expect.anything()
    );
  });

  it('2. Returns 204 No Content idempotently when session is missing or invalid', async () => {
    vi.spyOn(dbModule, 'revokeSession').mockResolvedValueOnce(false);

    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(204);

    const bodyText = await res.text();
    expect(bodyText).toBe('');
  });

  it('3. Returns 204 and extracts percent-encoded session token from Cookie header when cookies() store has no token', async () => {
    mockCookieValue = undefined;
    const revokeSpy = vi.spyOn(dbModule, 'revokeSession').mockResolvedValueOnce(true);

    // Provide raw Cookie header with URL-encoded token
    const encodedToken = encodeURIComponent('special+token%val==');
    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `other_cookie=123; session_token=${encodedToken}; extra=abc`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(revokeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'special+token%val==',
      expect.anything()
    );
  });

  it('4. Returns 500 INTERNAL_ERROR when revokeSession throws an unexpected error', async () => {
    vi.spyOn(dbModule, 'revokeSession').mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toContain('unexpected');
  });
});
