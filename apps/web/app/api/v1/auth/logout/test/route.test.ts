import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (name === 'session_token' ? { value: 'test-cookie-token' } : undefined),
  }),
}));

describe('POST /api/v1/auth/logout Route Handler Unit Tests', () => {
  it('1. Returns 204 No Content with no response body and clears session_token cookie', async () => {
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
});
