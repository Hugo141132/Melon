import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { publishRealtimeEvent } from '../events/webhook';
import { logger } from '../observability/logger';
import { GatewayEnv } from '../config/env';

vi.mock('../observability/logger');

const originalFetch = global.fetch;

describe('Realtime Webhook Publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should not publish if env is null', async () => {
    await publishRealtimeEvent(null, 'test', {});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('GatewayEnv not bound'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should not publish if WEB_APP_URL is missing', async () => {
    const env = { INTERNAL_SERVICE_TOKEN: 'token' } as GatewayEnv;
    await publishRealtimeEvent(env, 'test', {});
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('WEB_APP_URL not configured')
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should publish successfully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
    });

    const env = {
      WEB_APP_URL: 'http://localhost:3000',
      INTERNAL_SERVICE_TOKEN: 'secret123',
    } as GatewayEnv;

    await publishRealtimeEvent(env, 'faucet.command.updated', { status: 'QUEUED' }, 'dev-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/internal/realtime/publish',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret123',
        },
        body: JSON.stringify({
          event: {
            name: 'faucet.command.updated',
            deviceId: 'dev-1',
            data: { status: 'QUEUED' },
          },
        }),
      })
    );
  });
});
