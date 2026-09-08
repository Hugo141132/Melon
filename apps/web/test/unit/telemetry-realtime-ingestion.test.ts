import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as postSoil } from '../../app/api/v1/devices/[deviceId]/telemetry/soil/route';
import { POST as postWater } from '../../app/api/v1/devices/[deviceId]/telemetry/water/route';
import { GET as getStream } from '../../app/api/v1/realtime/stream/route';
import { realtimeEventHub } from '../../lib/realtime/event-hub';
import { logger } from '../../lib/observability/logger';
import { SESSION_COOKIE_NAME } from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

const { mockIngestSoilReading, mockIngestWaterReading } = vi.hoisted(() => ({
  mockIngestSoilReading: vi.fn(),
  mockIngestWaterReading: vi.fn(),
}));

// Mock dependencies
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
    TelemetryRepository: class MockTelemetryRepository {
      ingestSoilReading = mockIngestSoilReading;
      ingestWaterReading = mockIngestWaterReading;
    },
    DeviceNotFoundError: class DeviceNotFoundError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'DeviceNotFoundError';
      }
    },
  };
});

import {
  validateSession,
  verifyStreamSessionActive,
  prisma,
  DeviceNotFoundError,
} from '@kebun-melon/database';

describe('Realtime Ingestion-to-SSE Delivery Unit Test Suite', () => {
  const VALID_TOKEN = 'test-owner-token-999';
  const VALID_USER_ID = '10000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeEventHub.clearListeners();

    vi.mocked(prisma.device.findFirst).mockResolvedValue({
      id: 'dev-uuid-soil-01',
      deviceId: 'soil-node-biuc2f',
    } as any);
  });

  describe('Soil Telemetry Ingestion to Realtime Hub', () => {
    const validSoilPayload = {
      schemaVersion: '1.0',
      messageId: 'soil-msg-001',
      deviceId: 'soil-node-biuc2f',
      data: {
        nitrogen: 15.5,
        phosphorus: 20.0,
        potassium: 35.2,
        temperature: 24.5,
        moisture: 65.0,
        ph: 6.5,
        ec: 1.2,
        status: 'NORMAL',
      },
    };

    it('publishes telemetry.soil.updated on successful non-duplicate ingestion (HTTP 201)', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      mockIngestSoilReading.mockResolvedValueOnce({
        readingId: 'reading-soil-001',
        deviceId: 'dev-uuid-soil-01',
        canonicalDeviceId: 'soil-node-biuc2f',
        messageId: 'soil-msg-001',
        recordedAt: new Date('2026-09-08T12:00:00Z'),
        receivedAt: new Date('2026-09-08T12:00:01Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-biuc2f',
          },
          body: JSON.stringify(validSoilPayload),
        }
      );

      const response = await postSoil(request, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.readingId).toBe('reading-soil-001');

      // Verify event was published with correct event name and payload
      expect(publishSpy).toHaveBeenCalledTimes(1);
      const publishedEvent = publishSpy.mock.calls[0][0];
      expect(publishedEvent.name).toBe('telemetry.soil.updated');
      expect(publishedEvent.deviceId).toBe('soil-node-biuc2f');
      expect(publishedEvent.data).toMatchObject({
        readingId: 'reading-soil-001',
        deviceId: 'dev-uuid-soil-01',
        canonicalDeviceId: 'soil-node-biuc2f',
        messageId: 'soil-msg-001',
        nitrogen: 15.5,
        phosphorus: 20.0,
        potassium: 35.2,
        temperature: 24.5,
        moisture: 65.0,
        ph: 6.5,
        ec: 1.2,
        status: 'NORMAL',
        validationStatus: 'VALID',
      });
    });

    it('does NOT publish event for duplicate reading (HTTP 200 idempotency)', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      mockIngestSoilReading.mockResolvedValueOnce({
        readingId: 'reading-soil-001',
        deviceId: 'dev-uuid-soil-01',
        canonicalDeviceId: 'soil-node-biuc2f',
        messageId: 'soil-msg-001',
        recordedAt: new Date('2026-09-08T12:00:00Z'),
        receivedAt: new Date('2026-09-08T12:00:01Z'),
        isDuplicate: true,
        validationStatus: 'VALID',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-biuc2f',
          },
          body: JSON.stringify(validSoilPayload),
        }
      );

      const response = await postSoil(request, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.isDuplicate).toBe(true);

      // Verify no event published
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('does NOT publish event on ingestion failure (e.g. missing auth header, validation error, DeviceNotFoundError)', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      // 1. Missing X-Device-Id header
      const reqMissingHeader = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validSoilPayload),
        }
      );
      const res1 = await postSoil(reqMissingHeader, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });
      expect(res1.status).toBe(401);
      expect(publishSpy).not.toHaveBeenCalled();

      // 2. DeviceNotFoundError
      mockIngestSoilReading.mockRejectedValueOnce(
        new DeviceNotFoundError("Device 'soil-node-biuc2f' not found.")
      );
      const reqNotFound = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-biuc2f',
          },
          body: JSON.stringify(validSoilPayload),
        }
      );
      const res2 = await postSoil(reqNotFound, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });
      expect(res2.status).toBe(404);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('gracefully logs error and preserves HTTP 201 response if realtimeEventHub.publish throws', async () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.spyOn(realtimeEventHub, 'publish').mockImplementationOnce(() => {
        throw new Error('Realtime event hub broadcast failure');
      });

      mockIngestSoilReading.mockResolvedValueOnce({
        readingId: 'reading-soil-002',
        deviceId: 'dev-uuid-soil-01',
        canonicalDeviceId: 'soil-node-biuc2f',
        messageId: 'soil-msg-002',
        recordedAt: new Date('2026-09-08T12:00:00Z'),
        receivedAt: new Date('2026-09-08T12:00:01Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-biuc2f',
          },
          body: JSON.stringify({ ...validSoilPayload, messageId: 'soil-msg-002' }),
        }
      );

      const response = await postSoil(request, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });

      // Still returns 201 despite event-hub failure
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.readingId).toBe('reading-soil-002');

      // Verify logger recorded the error
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to publish soil telemetry event to realtime event hub',
        expect.any(Error),
        expect.objectContaining({
          deviceId: 'soil-node-biuc2f',
          readingId: 'reading-soil-002',
        })
      );
    });
  });

  describe('Water Telemetry Ingestion to Realtime Hub', () => {
    const validWaterPayload = {
      schemaVersion: '1.0',
      messageId: 'water-msg-001',
      deviceId: 'water-node-001',
      data: {
        ph: 7.2,
        tds: 350.5,
        ec: 1.8,
        status: 'NORMAL',
      },
    };

    it('publishes telemetry.water.updated on successful non-duplicate ingestion (HTTP 201)', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      mockIngestWaterReading.mockResolvedValueOnce({
        readingId: 'reading-water-001',
        deviceId: 'dev-uuid-water-01',
        canonicalDeviceId: 'water-node-001',
        messageId: 'water-msg-001',
        recordedAt: new Date('2026-09-08T12:05:00Z'),
        receivedAt: new Date('2026-09-08T12:05:01Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/devices/water-node-001/telemetry/water',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'water-node-001',
          },
          body: JSON.stringify(validWaterPayload),
        }
      );

      const response = await postWater(request, {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.readingId).toBe('reading-water-001');

      expect(publishSpy).toHaveBeenCalledTimes(1);
      const publishedEvent = publishSpy.mock.calls[0][0];
      expect(publishedEvent.name).toBe('telemetry.water.updated');
      expect(publishedEvent.deviceId).toBe('water-node-001');
      expect(publishedEvent.data).toMatchObject({
        readingId: 'reading-water-001',
        deviceId: 'dev-uuid-water-01',
        canonicalDeviceId: 'water-node-001',
        messageId: 'water-msg-001',
        ph: 7.2,
        tds: 350.5,
        ec: 1.8,
        status: 'NORMAL',
        validationStatus: 'VALID',
      });
    });

    it('does NOT publish event for duplicate water reading (HTTP 200 idempotency)', async () => {
      const publishSpy = vi.spyOn(realtimeEventHub, 'publish');

      mockIngestWaterReading.mockResolvedValueOnce({
        readingId: 'reading-water-001',
        deviceId: 'dev-uuid-water-01',
        canonicalDeviceId: 'water-node-001',
        messageId: 'water-msg-001',
        recordedAt: new Date('2026-09-08T12:05:00Z'),
        receivedAt: new Date('2026-09-08T12:05:01Z'),
        isDuplicate: true,
        validationStatus: 'VALID',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/devices/water-node-001/telemetry/water',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'water-node-001',
          },
          body: JSON.stringify(validWaterPayload),
        }
      );

      const response = await postWater(request, {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });

      expect(response.status).toBe(200);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('End-to-End Ingestion to SSE Subscriber Delivery', () => {
    it('delivers ingested telemetry to an active GET /api/v1/realtime/stream subscriber', async () => {
      // Setup authenticated Owner subscriber
      vi.mocked(validateSession).mockResolvedValueOnce({
        id: 'sess-owner-1',
        userId: VALID_USER_ID,
        token: VALID_TOKEN,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        revokedAt: null,
        user: {
          id: VALID_USER_ID,
          fullName: 'Owner User',
          email: 'owner@example.com',
          accountStatus: AccountStatus.ACTIVE,
          activeRoles: [UserRole.OWNER],
        },
      } as any);

      vi.mocked(verifyStreamSessionActive).mockResolvedValue(true);

      // Connect subscriber for device soil-node-biuc2f
      const streamReq = new Request(
        'http://localhost:3000/api/v1/realtime/stream?deviceId=soil-node-biuc2f',
        {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${VALID_TOKEN}` },
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

      // Now trigger real soil telemetry ingestion
      mockIngestSoilReading.mockResolvedValueOnce({
        readingId: 'reading-stream-test',
        deviceId: 'dev-uuid-soil-01',
        canonicalDeviceId: 'soil-node-biuc2f',
        messageId: 'msg-stream-live-999',
        recordedAt: new Date('2026-09-08T12:10:00Z'),
        receivedAt: new Date('2026-09-08T12:10:01Z'),
        isDuplicate: false,
        validationStatus: 'VALID',
      });

      const ingestReq = new Request(
        'http://localhost:3000/api/v1/devices/soil-node-biuc2f/telemetry/soil',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'soil-node-biuc2f',
          },
          body: JSON.stringify({
            schemaVersion: '1.0',
            messageId: 'msg-stream-live-999',
            deviceId: 'soil-node-biuc2f',
            data: {
              nitrogen: 18.5,
              phosphorus: 22.1,
              potassium: 31.0,
              temperature: 27.2,
              moisture: 73.0,
              ph: 6.8,
              ec: 1.5,
              status: 'NORMAL',
            },
          }),
        }
      );

      const ingestRes = await postSoil(ingestReq, {
        params: Promise.resolve({ deviceId: 'soil-node-biuc2f' }),
      });
      expect(ingestRes.status).toBe(201);

      // Now read the next chunk from the SSE subscriber stream
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
