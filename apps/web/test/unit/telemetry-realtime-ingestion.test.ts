import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as postInternalPublish } from '../../app/api/v1/internal/realtime/publish/route';
import { GET as getStream } from '../../app/api/v1/realtime/stream/route';
import { realtimeEventHub } from '../../lib/realtime/event-hub';
import { SESSION_COOKIE_NAME } from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

// Mock validateServerEnv
vi.mock('@/lib/env/server', () => ({
  validateServerEnv: vi.fn().mockReturnValue({
    INTERNAL_SERVICE_TOKEN: 'test-internal-token-secret-123',
  }),
}));

// Mock database dependencies for SSE stream authentication
vi.mock('@kebun-melon/database', async () => {
  const actual = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    validateSession: vi.fn(),
    verifyStreamSessionActive: vi.fn(),
    prisma: {
      device: {
        findFirst: vi.fn(),
      },
      userDeviceAccess: {
        findFirst: vi.fn(),
      },
    },
  };
});

import { validateSession, verifyStreamSessionActive, prisma } from '@kebun-melon/database';

describe('Realtime Internal Ingestion-to-SSE Delivery Unit Test Suite (TASK-0412)', () => {
  const VALID_USER_TOKEN = 'test-owner-token-999';
  const VALID_USER_ID = '10000000-0000-0000-0000-000000000001';
  const INTERNAL_TOKEN = 'test-internal-token-secret-123';

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeEventHub.clearListeners();

    vi.mocked(prisma.device.findFirst).mockResolvedValue({
      id: 'dev-uuid-soil-01',
      deviceId: 'melon-esp32-tanah1',
    } as any);
  });

  describe('Internal Webhook Authentication & Validation', () => {
    it('rejects internal webhook request without authorization header (HTTP 401)', async () => {
      const request = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            name: 'telemetry.soil.updated',
            data: { readingId: 'reading-1' },
          },
        }),
      });

      const response = await postInternalPublish(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('rejects internal webhook request with invalid bearer token (HTTP 401)', async () => {
      const request = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token-xyz',
        },
        body: JSON.stringify({
          event: {
            name: 'telemetry.soil.updated',
            data: { readingId: 'reading-1' },
          },
        }),
      });

      const response = await postInternalPublish(request);
      expect(response.status).toBe(401);
    });

    it('rejects malformed payload missing event details (HTTP 400)', async () => {
      const request = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ notAnEvent: true }),
      });

      const response = await postInternalPublish(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid payload format');
    });
  });

  describe('Internal Webhook Publishing to Realtime Hub', () => {
    it('publishes telemetry.soil.updated to RealtimeEventHub on valid internal webhook call', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      const soilEvent = {
        name: 'telemetry.soil.updated',
        deviceId: 'melon-esp32-tanah1',
        data: {
          readingId: 'reading-soil-001',
          deviceId: 'dev-uuid-soil-01',
          canonicalDeviceId: 'melon-esp32-tanah1',
          messageId: 'soil-msg-001',
          nitrogen: 45,
          phosphorus: 30,
          potassium: 120,
          temperature: 28.5,
          moisture: 65.0,
          ph: 6.8,
          ec: 1.4,
          status: 'NORMAL',
          validationStatus: 'VALID',
        },
      };

      const request = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ event: soilEvent }),
      });

      const response = await postInternalPublish(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);

      expect(publishSpy).toHaveBeenCalledWith({
        name: 'telemetry.soil.updated',
        deviceId: 'melon-esp32-tanah1',
        data: soilEvent.data,
      });
    });

    it('publishes telemetry.water.updated to RealtimeEventHub on valid internal webhook call', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      const waterEvent = {
        name: 'telemetry.water.updated',
        deviceId: 'melon-esp32-air1',
        data: {
          readingId: 'reading-water-001',
          deviceId: 'dev-uuid-water-01',
          canonicalDeviceId: 'melon-esp32-air1',
          messageId: 'water-msg-001',
          ph: 7.2,
          tds: 450,
          ec: 0.9,
          status: 'NORMAL',
          validationStatus: 'VALID',
        },
      };

      const request = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ event: waterEvent }),
      });

      const response = await postInternalPublish(request);
      expect(response.status).toBe(200);

      expect(publishSpy).toHaveBeenCalledWith({
        name: 'telemetry.water.updated',
        deviceId: 'melon-esp32-air1',
        data: waterEvent.data,
      });
    });
  });

  describe('End-to-End Delivery to SSE Stream Subscriber', () => {
    it('delivers telemetry.soil.updated to connected SSE subscriber', async () => {
      // Setup authenticated Owner session
      vi.mocked(validateSession).mockResolvedValue({
        id: 'session-uuid-1',
        userId: VALID_USER_ID,
        token: VALID_USER_TOKEN,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        user: {
          id: VALID_USER_ID,
          fullName: 'Owner User',
          email: 'owner@example.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.OWNER],
        },
      } as any);

      vi.mocked(verifyStreamSessionActive).mockResolvedValue(true);

      // Connect subscriber for device melon-esp32-tanah1
      const streamReq = new Request(
        'http://localhost:3000/api/v1/realtime/stream?deviceId=melon-esp32-tanah1',
        {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_USER_TOKEN}` },
        }
      );
      const streamRes = await getStream(streamReq);
      expect(streamRes.status).toBe(200);

      const reader = streamRes.body?.getReader();
      expect(reader).toBeDefined();

      // Read initial "connected" event
      const firstChunk = await reader!.read();
      const firstText = new TextDecoder().decode(firstChunk.value);
      expect(firstText).toContain('event: connected');

      // Publish soil telemetry via internal webhook
      const soilEvent = {
        name: 'telemetry.soil.updated',
        deviceId: 'melon-esp32-tanah1',
        data: {
          readingId: 'reading-stream-test',
          deviceId: 'dev-uuid-soil-01',
          canonicalDeviceId: 'melon-esp32-tanah1',
          messageId: 'msg-stream-live-999',
          nitrogen: 18.5,
          phosphorus: 22.1,
          potassium: 31.0,
          temperature: 27.2,
          moisture: 73.0,
          ph: 6.8,
          ec: 1.5,
          status: 'NORMAL',
          validationStatus: 'VALID',
        },
      };

      const webhookReq = new Request('http://localhost:3000/api/v1/internal/realtime/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ event: soilEvent }),
      });

      const webhookRes = await postInternalPublish(webhookReq);
      expect(webhookRes.status).toBe(200);

      // Read next chunk from SSE subscriber
      const secondChunk = await reader!.read();
      const secondText = new TextDecoder().decode(secondChunk.value);

      expect(secondText).toContain('event: telemetry.soil.updated');
      expect(secondText).toContain('msg-stream-live-999');
      expect(secondText).toContain('"nitrogen":18.5');
      expect(secondText).toContain('"moisture":73');
      expect(secondText).toContain('"readingId":"reading-stream-test"');

      reader!.cancel();
    });
  });
});
