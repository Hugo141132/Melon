import { describe, it, expect } from 'vitest';
import {
  createMockApiRequest,
  createMockAuthenticatedSession,
  parseApiResponseEnvelope,
} from './helpers/api-test-helper';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

describe('API Test Helpers', () => {
  it('creates a mock NextRequest with JSON body and custom headers', async () => {
    const req = createMockApiRequest({
      url: 'http://localhost:3000/api/v1/test',
      method: 'POST',
      body: { name: 'test' },
      headers: { 'x-correlation-id': 'req-123' },
    });

    expect(req.url).toBe('http://localhost:3000/api/v1/test');
    expect(req.method).toBe('POST');
    expect(req.headers.get('x-correlation-id')).toBe('req-123');
    const json = await req.json();
    expect(json).toEqual({ name: 'test' });
  });

  it('creates mock authenticated session overrides', () => {
    const session = createMockAuthenticatedSession({
      role: UserRole.OWNER,
      accountStatus: AccountStatus.ACTIVE,
    });

    expect(session.role).toBe(UserRole.OWNER);
    expect(session.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(session.userId).toMatch(/^user-/);
  });

  it('parses API response envelope', async () => {
    const res = new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 });
    const envelope = await parseApiResponseEnvelope<{ success: boolean; data: { id: number } }>(
      res
    );
    expect(envelope.status).toBe(200);
    expect(envelope.body.success).toBe(true);
    expect(envelope.body.data.id).toBe(1);
  });
});
