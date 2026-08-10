import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';

const mockIngestWaterReading = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    TelemetryRepository: class {
      ingestWaterReading(...args: any[]) {
        return mockIngestWaterReading(...args);
      }
    },
  };
});

describe('HTTPS REST Water Telemetry Ingestion Endpoint Auth & Logic (TASK-0406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    schemaVersion: '1.0',
    messageId: 'water-msg-000001',
    deviceId: 'water-node-001',
    siteId: 'site-01',
    sequence: 1,
    recordedAt: '2026-08-10T10:00:00.000Z',
    data: {
      ph: 6.8,
      tds: 420,
      ec: 1.25,
      status: 'NORMAL',
    },
  };

  it('1. Accepts valid device request with matching X-Device-Id header (201 Created)', async () => {
    const recordedAt = new Date('2026-08-10T10:00:00.000Z');
    const receivedAt = new Date('2026-08-10T10:00:01.000Z');

    mockIngestWaterReading.mockResolvedValueOnce({
      readingId: 'water-reading-uuid-1',
      deviceId: 'water-dev-uuid-1',
      canonicalDeviceId: 'water-node-001',
      messageId: 'water-msg-000001',
      recordedAt,
      receivedAt,
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.readingId).toBe('water-reading-uuid-1');
    expect(json.data.isDuplicate).toBe(false);

    expect(mockIngestWaterReading).toHaveBeenCalledWith({
      deviceId: 'water-node-001',
      messageId: 'water-msg-000001',
      schemaVersion: '1.0',
      sequenceNumber: 1,
      recordedAt: '2026-08-10T10:00:00.000Z',
      ph: 6.8,
      tds: 420,
      ec: 1.25,
      status: 'NORMAL',
    });
  });

  it('2. Rejects request with missing X-Device-Id auth header (401 UNAUTHORIZED_DEVICE)', async () => {
    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED_DEVICE');
    expect(mockIngestWaterReading).not.toHaveBeenCalled();
  });

  it('3. Rejects request with invalid/mismatched X-Device-Id auth header (401 UNAUTHORIZED_DEVICE)', async () => {
    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'unauthorized-other-device',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED_DEVICE');
    expect(mockIngestWaterReading).not.toHaveBeenCalled();
  });

  it('4. Handles duplicate message idempotently (200 OK with isDuplicate: true)', async () => {
    mockIngestWaterReading.mockResolvedValueOnce({
      readingId: 'water-reading-uuid-1',
      deviceId: 'water-dev-uuid-1',
      canonicalDeviceId: 'water-node-001',
      messageId: 'water-msg-000001',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: true,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.isDuplicate).toBe(true);
  });

  it('5. Rejects invalid schema payload (422 VALIDATION_ERROR)', async () => {
    const invalidTypePayload = {
      ...validPayload,
      data: {
        ...validPayload.data,
        ph: 'not-a-number', // Invalid type
      },
    };

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(invalidTypePayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockIngestWaterReading).not.toHaveBeenCalled();
  });

  it('6. Preserves numeric zero values in data object', async () => {
    const zeroPayload = {
      ...validPayload,
      messageId: 'water-msg-zero',
      data: {
        ph: 0,
        tds: 0,
        ec: 0,
        status: 'NORMAL',
      },
    };

    mockIngestWaterReading.mockResolvedValueOnce({
      readingId: 'water-reading-uuid-zero',
      deviceId: 'water-dev-uuid-1',
      canonicalDeviceId: 'water-node-001',
      messageId: 'water-msg-zero',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(zeroPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    expect(res.status).toBe(201);

    expect(mockIngestWaterReading).toHaveBeenCalledWith(
      expect.objectContaining({
        ph: 0,
        tds: 0,
        ec: 0,
      })
    );
  });

  it('7. Preserves missing/null values as null', async () => {
    const nullPayload = {
      schemaVersion: '1.0',
      messageId: 'water-msg-null',
      deviceId: 'water-node-001',
      data: {
        ph: 6.8,
        // tds, ec missing
      },
    };

    mockIngestWaterReading.mockResolvedValueOnce({
      readingId: 'water-reading-uuid-null',
      deviceId: 'water-dev-uuid-1',
      canonicalDeviceId: 'water-node-001',
      messageId: 'water-msg-null',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(nullPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    expect(res.status).toBe(201);

    expect(mockIngestWaterReading).toHaveBeenCalledWith(
      expect.objectContaining({
        ph: 6.8,
        tds: null,
        ec: null,
      })
    );
  });

  it('8. Rejects path vs payload deviceId mismatch (400 DEVICE_ID_MISMATCH)', async () => {
    const mismatchPayload = {
      ...validPayload,
      deviceId: 'different-water-device',
    };

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(mismatchPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_ID_MISMATCH');
    expect(mockIngestWaterReading).not.toHaveBeenCalled();
  });

  it('9. Returns 404 when device is not found in database', async () => {
    mockIngestWaterReading.mockRejectedValueOnce(
      new dbModule.DeviceNotFoundError("Device 'water-node-999' was not found.")
    );

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-999/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-999',
      },
      body: JSON.stringify({ ...validPayload, deviceId: 'water-node-999' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-999' }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('10. Returns 403 when device is inactive', async () => {
    mockIngestWaterReading.mockRejectedValueOnce(
      new dbModule.DeviceInactiveError("Device 'water-node-001' is not active.")
    );

    const req = new Request('http://localhost:3000/api/v1/devices/water-node-001/telemetry/water', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'water-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_INACTIVE');
  });
});
