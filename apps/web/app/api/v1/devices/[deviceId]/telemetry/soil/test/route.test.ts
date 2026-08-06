import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import * as dbModule from '@kebun-melon/database';

const mockIngestSoilReading = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    TelemetryRepository: class {
      ingestSoilReading(...args: any[]) {
        return mockIngestSoilReading(...args);
      }
    },
  };
});

describe('HTTPS REST Soil Telemetry Ingestion Endpoint Auth & Logic (TASK-0405)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    schemaVersion: '1.0',
    messageId: '10000000-0000-0000-0000-000000000001',
    deviceId: 'soil-node-001',
    siteId: 'site-01',
    sequence: 1,
    recordedAt: '2026-08-01T08:00:00.000Z',
    data: {
      nitrogen: 45.2,
      phosphorus: 21.8,
      potassium: 73.1,
      temperature: 28.4,
      moisture: 67.3,
      ph: 6.5,
      ec: 1.42,
      status: 'NORMAL',
    },
  };

  it('1. Accepts valid device request with matching X-Device-Id header (201 Created)', async () => {
    const recordedAt = new Date('2026-08-01T08:00:00.000Z');
    const receivedAt = new Date('2026-08-01T08:00:01.000Z');

    mockIngestSoilReading.mockResolvedValueOnce({
      readingId: 'reading-uuid-1',
      deviceId: 'dev-uuid-1',
      canonicalDeviceId: 'soil-node-001',
      messageId: '10000000-0000-0000-0000-000000000001',
      recordedAt,
      receivedAt,
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.readingId).toBe('reading-uuid-1');
    expect(json.data.isDuplicate).toBe(false);

    expect(mockIngestSoilReading).toHaveBeenCalledWith({
      deviceId: 'soil-node-001',
      messageId: '10000000-0000-0000-0000-000000000001',
      schemaVersion: '1.0',
      sequenceNumber: 1,
      recordedAt: '2026-08-01T08:00:00.000Z',
      nitrogen: 45.2,
      phosphorus: 21.8,
      potassium: 73.1,
      temperature: 28.4,
      moisture: 67.3,
      ph: 6.5,
      ec: 1.42,
      status: 'NORMAL',
    });
  });

  it('2. Rejects request with missing X-Device-Id auth header (401 UNAUTHORIZED_DEVICE)', async () => {
    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED_DEVICE');
    expect(mockIngestSoilReading).not.toHaveBeenCalled();
  });

  it('3. Rejects request with invalid/mismatched X-Device-Id auth header (401 UNAUTHORIZED_DEVICE)', async () => {
    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'unauthorized-other-device',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED_DEVICE');
    expect(mockIngestSoilReading).not.toHaveBeenCalled();
  });

  it('4. Handles duplicate message idempotently (200 OK with isDuplicate: true)', async () => {
    mockIngestSoilReading.mockResolvedValueOnce({
      readingId: 'reading-uuid-1',
      deviceId: 'dev-uuid-1',
      canonicalDeviceId: 'soil-node-001',
      messageId: '10000000-0000-0000-0000-000000000001',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: true,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.isDuplicate).toBe(true);
  });

  it('5. Preserves numeric zero values in data object', async () => {
    const zeroPayload = {
      ...validPayload,
      messageId: '20000000-0000-0000-0000-000000000002',
      data: {
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        temperature: 25.0,
        moisture: 50.0,
        ph: 7.0,
        ec: 0,
        status: 'NORMAL',
      },
    };

    mockIngestSoilReading.mockResolvedValueOnce({
      readingId: 'reading-uuid-2',
      deviceId: 'dev-uuid-1',
      canonicalDeviceId: 'soil-node-001',
      messageId: '20000000-0000-0000-0000-000000000002',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(zeroPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    expect(res.status).toBe(201);

    expect(mockIngestSoilReading).toHaveBeenCalledWith(
      expect.objectContaining({
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        ec: 0,
      })
    );
  });

  it('6. Preserves missing/null values as null', async () => {
    const nullPayload = {
      schemaVersion: '1.0',
      messageId: '30000000-0000-0000-0000-000000000003',
      deviceId: 'soil-node-001',
      data: {
        nitrogen: null,
        ph: 6.8,
      },
    };

    mockIngestSoilReading.mockResolvedValueOnce({
      readingId: 'reading-uuid-3',
      deviceId: 'dev-uuid-1',
      canonicalDeviceId: 'soil-node-001',
      messageId: '30000000-0000-0000-0000-000000000003',
      recordedAt: new Date(),
      receivedAt: new Date(),
      isDuplicate: false,
      validationStatus: 'VALID',
    });

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(nullPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    expect(res.status).toBe(201);

    expect(mockIngestSoilReading).toHaveBeenCalledWith(
      expect.objectContaining({
        nitrogen: null,
        phosphorus: null,
        ph: 6.8,
      })
    );
  });

  it('7. Rejects path vs payload deviceId mismatch (400 DEVICE_ID_MISMATCH)', async () => {
    const mismatchPayload = {
      ...validPayload,
      deviceId: 'different-device-id',
    };

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(mismatchPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_ID_MISMATCH');
    expect(mockIngestSoilReading).not.toHaveBeenCalled();
  });

  it('8. Rejects invalid schema payload (422 VALIDATION_ERROR)', async () => {
    const invalidPayload = {
      schemaVersion: '1.0',
      messageId: 'not-a-uuid',
      deviceId: 'soil-node-001',
      data: {
        nitrogen: 'invalid-string-instead-of-number',
      },
    };

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(invalidPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockIngestSoilReading).not.toHaveBeenCalled();
  });

  it('9. Returns 404 when device is not found in database', async () => {
    mockIngestSoilReading.mockRejectedValueOnce(
      new dbModule.DeviceNotFoundError("Device 'soil-node-999' was not found.")
    );

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-999/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-999',
      },
      body: JSON.stringify({ ...validPayload, deviceId: 'soil-node-999' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-999' }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('10. Returns 403 when device is inactive', async () => {
    mockIngestSoilReading.mockRejectedValueOnce(
      new dbModule.DeviceInactiveError("Device 'soil-node-001' is not active.")
    );

    const req = new Request('http://localhost:3000/api/v1/devices/soil-node-001/telemetry/soil', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'soil-node-001',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ deviceId: 'soil-node-001' }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DEVICE_INACTIVE');
  });
});
