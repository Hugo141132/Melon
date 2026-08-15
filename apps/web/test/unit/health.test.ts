import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as healthGet } from '../../app/health/route';
import { GET as readyGet } from '../../app/ready/route';
import { prisma } from '@kebun-melon/database';

vi.mock('@kebun-melon/database', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('Web Health & Readiness Endpoints', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
    process.env.DATABASE_URL = 'postgresql://test:testpass@localhost:5432/testdb';
    process.env.INTERNAL_GATEWAY_URL = 'http://127.0.0.1:3001';
    process.env.INTERNAL_SERVICE_TOKEN = 'secret_test_token_12345';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('GET /health (Liveness)', () => {
    it('returns HTTP 200 { status: "ok" } independently of database state', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB Connection Refused'));

      const response = await healthGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toEqual({ status: 'ok' });
    });
  });

  describe('GET /ready (Readiness)', () => {
    it('returns HTTP 200 with status "ready" when DB, Gateway, and Broker are healthy', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ready',
          dependencies: {
            database: 'up',
            broker: 'up',
          },
        }),
      } as any);

      const response = await readyGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toEqual({
        status: 'ready',
        dependencies: {
          database: 'up',
          gateway: 'up',
          broker: 'up',
        },
      });

      // Verify bearer token was sent in authorization header
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/internal/v1/ready',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret_test_token_12345',
          }),
        })
      );
    });

    it('returns HTTP 503 with status "degraded" when Broker is down at Gateway', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          status: 'degraded',
          dependencies: {
            database: 'up',
            broker: 'down',
          },
        }),
      } as any);

      const response = await readyGet();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json).toEqual({
        status: 'degraded',
        dependencies: {
          database: 'up',
          gateway: 'up',
          broker: 'down',
        },
      });
    });

    it('returns HTTP 503 with status "down" when Database is unreachable', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection reset'));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ready',
          dependencies: {
            database: 'up',
            broker: 'up',
          },
        }),
      } as any);

      const response = await readyGet();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json.status).toBe('down');
      expect(json.dependencies.database).toBe('down');
      expect(json.dependencies.gateway).toBe('up');
      expect(json.dependencies.broker).toBe('up');
    });

    it('returns HTTP 503 with status "degraded" when Gateway is unreachable or probe times out', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);

      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const response = await readyGet();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json).toEqual({
        status: 'degraded',
        dependencies: {
          database: 'up',
          gateway: 'down',
          broker: 'down',
        },
      });
    });

    it('does not expose internal tokens, credentials, or connection strings in payloads', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '1': 1 }]);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ready',
          dependencies: { database: 'up', broker: 'up' },
        }),
      } as any);

      const response = await readyGet();
      const text = JSON.stringify(await response.json());

      expect(text).not.toContain('testpass');
      expect(text).not.toContain('secret_test_token_12345');
      expect(text).not.toContain('postgresql://');
    });
  });
});
