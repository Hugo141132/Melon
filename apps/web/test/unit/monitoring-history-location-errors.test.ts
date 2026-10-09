import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceNotFoundError } from '@kebun-melon/database';

const {
  mockRequireActiveAccount,
  mockRequirePermission,
  mockRequireSession,
  mockGetSessionOrNull,
  mockRequireDeviceViewAccess,
  mockGetDeviceByCanonicalId,
  mockGetSoilReadingLocations,
  mockGetWaterReadingLocations,
  mockGetSoilChartSeries,
  mockGetWaterChartSeries,
  mockGetWaterHistory,
} = vi.hoisted(() => ({
  mockRequireActiveAccount: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockRequireSession: vi.fn(),
  mockGetSessionOrNull: vi.fn(),
  mockRequireDeviceViewAccess: vi.fn(),
  mockGetDeviceByCanonicalId: vi.fn(),
  mockGetSoilReadingLocations: vi.fn(),
  mockGetWaterReadingLocations: vi.fn(),
  mockGetSoilChartSeries: vi.fn(),
  mockGetWaterChartSeries: vi.fn(),
  mockGetWaterHistory: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('@kebun-melon/database', () => {
  class MockDeviceNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeviceNotFoundError';
    }
  }

  return {
    prisma: {},
    DeviceNotFoundError: MockDeviceNotFoundError,
    DeviceRepository: class {
      getDeviceByCanonicalId = mockGetDeviceByCanonicalId;
    },
    TelemetryRepository: class {
      getSoilReadingLocations = mockGetSoilReadingLocations;
      getWaterReadingLocations = mockGetWaterReadingLocations;
      getSoilChartSeries = mockGetSoilChartSeries;
      getWaterChartSeries = mockGetWaterChartSeries;
      getWaterHistory = mockGetWaterHistory;
    },
  };
});

vi.mock('@/lib/auth/rbac', () => ({
  getSessionOrNull: mockGetSessionOrNull,
  requireSession: mockRequireSession,
  requireActiveAccount: mockRequireActiveAccount,
  requirePermission: mockRequirePermission,
  requireDeviceViewAccess: mockRequireDeviceViewAccess,
  AuthorizationError: class AuthorizationError extends Error {
    statusCode = 403;
    code = 'INSUFFICIENT_PERMISSION';
  },
}));

import { GET as getSoilLocations } from '@/app/api/v1/devices/[deviceId]/monitoring/soil/locations/route';
import { GET as getSoilChart } from '@/app/api/v1/devices/[deviceId]/monitoring/soil/chart/route';
import { GET as getWaterLocations } from '@/app/api/v1/devices/[deviceId]/monitoring/water/locations/route';
import { GET as getWaterChart } from '@/app/api/v1/devices/[deviceId]/monitoring/water/chart/route';
import { GET as getWaterHistory } from '@/app/api/v1/devices/[deviceId]/monitoring/water/history/route';

describe('Monitoring History and Location Error Handling', () => {
  const sessionUser = {
    user: { id: 'user-1', email: 'owner@melon.test', role: 'OWNER' },
    activeRole: 'OWNER',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionOrNull.mockResolvedValue(sessionUser);
    mockRequireSession.mockResolvedValue(sessionUser);
    mockRequireActiveAccount.mockReturnValue(sessionUser);
    mockRequirePermission.mockReturnValue(undefined);
    mockRequireDeviceViewAccess.mockResolvedValue(undefined);
  });

  describe('GET /monitoring/soil/locations', () => {
    it('returns 404 DEVICE_NOT_FOUND when device does not exist', async () => {
      mockGetSoilReadingLocations.mockRejectedValueOnce(
        new DeviceNotFoundError("Device 'non-existent-device' not found.")
      );

      const req = new Request(
        'http://localhost/api/v1/devices/non-existent-device/monitoring/soil/locations'
      );
      const res = await getSoilLocations(req, {
        params: Promise.resolve({ deviceId: 'non-existent-device' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 200 with locations list when device exists', async () => {
      mockGetSoilReadingLocations.mockResolvedValueOnce([
        { locationKey: 'bed-a', locationName: 'Bed A', readingCount: 10 },
      ]);

      const req = new Request('http://localhost/api/v1/devices/soil-1/monitoring/soil/locations');
      const res = await getSoilLocations(req, {
        params: Promise.resolve({ deviceId: 'soil-1' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.locations).toHaveLength(1);
      expect(json.data.locations[0].locationKey).toBe('bed-a');
    });
  });

  describe('GET /monitoring/soil/chart', () => {
    it('returns 404 DEVICE_NOT_FOUND when repository throws DeviceNotFoundError', async () => {
      mockGetSoilChartSeries.mockRejectedValueOnce(
        new DeviceNotFoundError("Device 'non-existent-device' not found.")
      );

      const req = new Request(
        'http://localhost/api/v1/devices/non-existent-device/monitoring/soil/chart?locationKey=bed-a&from=2026-10-01T00:00:00.000Z&to=2026-10-02T00:00:00.000Z'
      );
      const res = await getSoilChart(req, {
        params: Promise.resolve({ deviceId: 'non-existent-device' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('GET /monitoring/water/locations', () => {
    it('returns 404 DEVICE_NOT_FOUND when device does not exist', async () => {
      mockGetWaterReadingLocations.mockRejectedValueOnce(
        new DeviceNotFoundError("Device 'non-existent-water' not found.")
      );

      const req = new Request(
        'http://localhost/api/v1/devices/non-existent-water/monitoring/water/locations'
      );
      const res = await getWaterLocations(req, {
        params: Promise.resolve({ deviceId: 'non-existent-water' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('GET /monitoring/water/chart', () => {
    it('returns 404 DEVICE_NOT_FOUND when repository throws DeviceNotFoundError', async () => {
      mockGetWaterChartSeries.mockRejectedValueOnce(
        new DeviceNotFoundError("Device 'non-existent-water' not found.")
      );

      const req = new Request(
        'http://localhost/api/v1/devices/non-existent-water/monitoring/water/chart?locationKey=tank-1&from=2026-10-01T00:00:00.000Z&to=2026-10-02T00:00:00.000Z'
      );
      const res = await getWaterChart(req, {
        params: Promise.resolve({ deviceId: 'non-existent-water' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('GET /monitoring/water/history', () => {
    it('rejects WATER_TANK_NODE with 400 VALIDATION_ERROR (only WATER_QUALITY_NODE allowed)', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce({
        id: 'tank-id-123',
        deviceId: 'water-tank-001',
        deviceType: 'WATER_TANK_NODE',
      });

      const req = new Request(
        'http://localhost/api/v1/devices/water-tank-001/monitoring/water/history'
      );
      const res = await getWaterHistory(req, {
        params: Promise.resolve({ deviceId: 'water-tank-001' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('WATER_TANK_NODE');
    });

    it('returns 404 DEVICE_NOT_FOUND when device does not exist in DeviceRepository', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(null);

      const req = new Request(
        'http://localhost/api/v1/devices/unknown-dev/monitoring/water/history'
      );
      const res = await getWaterHistory(req, {
        params: Promise.resolve({ deviceId: 'unknown-dev' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });
});
