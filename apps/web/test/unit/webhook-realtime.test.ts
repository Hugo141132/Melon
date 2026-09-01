import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/v1/internal/realtime/publish/route';
import { realtimeEventHub } from '@/lib/realtime/event-hub';
import { validateServerEnv } from '@/lib/env/server';

vi.mock('@/lib/realtime/event-hub', () => ({
  realtimeEventHub: {
    publish: vi.fn(),
  },
}));

vi.mock('@/lib/env/server', () => ({
  validateServerEnv: vi.fn(),
}));

describe('Webhook Realtime Publish API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if token is missing', async () => {
    vi.mocked(validateServerEnv).mockReturnValue({ INTERNAL_SERVICE_TOKEN: 'valid-token' } as any);

    const request = new Request('http://localhost/api/v1/internal/realtime/publish', {
      method: 'POST',
      headers: {},
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 401 if token is invalid', async () => {
    vi.mocked(validateServerEnv).mockReturnValue({ INTERNAL_SERVICE_TOKEN: 'valid-token' } as any);

    const request = new Request('http://localhost/api/v1/internal/realtime/publish', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 if payload is invalid', async () => {
    vi.mocked(validateServerEnv).mockReturnValue({ INTERNAL_SERVICE_TOKEN: 'valid-token' } as any);

    const request = new Request('http://localhost/api/v1/internal/realtime/publish', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ wrong: 'format' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should publish event and return 200 on success', async () => {
    vi.mocked(validateServerEnv).mockReturnValue({ INTERNAL_SERVICE_TOKEN: 'valid-token' } as any);

    const request = new Request('http://localhost/api/v1/internal/realtime/publish', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        event: {
          name: 'faucet.command.updated',
          deviceId: 'dev-123',
          data: { status: 'IN_PROGRESS' },
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(realtimeEventHub.publish).toHaveBeenCalledWith({
      name: 'faucet.command.updated',
      deviceId: 'dev-123',
      data: { status: 'IN_PROGRESS' },
    });
  });
});
