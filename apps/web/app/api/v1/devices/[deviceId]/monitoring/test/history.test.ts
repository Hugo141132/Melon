import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DeviceType,
  DeviceConnectionStatus,
  AccountStatus,
  UserRole,
} from '@kebun-melon/contracts';

const mockValidateSession = vi.fn();
const mockGetDeviceByCanonicalId = vi.fn();
const mockGetSoilHistory = vi.fn();
const mockGetWaterHistory = vi.fn();
const mockFindFirstUserDeviceAccess = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'session_token') {
        return { value: 'valid-token' };
      }
      return undefined;
    },
  }),
}));

vi.mock('@kebun-melon/database', async () => {
  const original = await vi.importActual<any>('@kebun-melon/database');
  return {
    ...original,
    validateSession: (...args: any[]) => mockValidateSession(...args),
    prisma: {
      userDeviceAccess: {
        findFirst: (...args: any[]) => mockFindFirstUserDeviceAccess(...args),
      },
    },
    DeviceRepository: class {
      getDeviceByCanonicalId(...args: any[]) {
        return mockGetDeviceByCanonicalId(...args);
      }
    },
    TelemetryRepository: class {
      getSoilHistory(...args: any[]) {
        return mockGetSoilHistory(...args);
      }
      getWaterHistory(...args: any[]) {
        return mockGetWaterHistory(...args);
      }
    },
  };
});

// Import route handlers AFTER vi.mock definitions so mocks apply cleanly
import { GET as GET_SOIL_HISTORY } from '../soil/history/route';
import { GET as GET_WATER_HISTORY } from '../water/history/route';

describe('Historical Monitoring API Endpoints (TASK-0503 & TASK-0504 Repairs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirstUserDeviceAccess.mockResolvedValue(null);
    mockGetSoilHistory.mockResolvedValue({
      deviceId: 'DEV-SOIL-001',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      interval: 'raw',
      series: [
        {
          timestamp: '2026-08-01T12:00:00.000Z',
          nitrogen: 0,
          phosphorus: null,
          potassium: 45.5,
          ph: 6.5,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalRecords: 1,
        totalPages: 1,
      },
    });
    mockGetWaterHistory.mockResolvedValue({
      deviceId: 'DEV-WATER-001',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      series: [
        {
          timestamp: '2026-08-01T12:00:00.000Z',
          ph: 7.2,
          tds: 0,
          ec: null,
        },
      ],
      pagination: { page: 1, pageSize: 20, totalRecords: 1, totalPages: 1 },
    });
  });

  const AUTH_HEADERS = { headers: { cookie: 'session_token=valid-token' } };

  const mockOwnerSession = () => {
    mockValidateSession.mockResolvedValue({
      session: { id: 's-owner', userId: 'owner-id-1', expiresAt: new Date() },
      user: {
        id: 'owner-id-1',
        fullName: 'Owner User',
        email: 'owner@test.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    });
  };

  const mockAdminSession = (accountStatus = AccountStatus.ACTIVE) => {
    mockValidateSession.mockResolvedValue({
      session: { id: 's-admin', userId: 'admin-id-1', expiresAt: new Date() },
      user: {
        id: 'admin-id-1',
        fullName: 'Admin User',
        email: 'admin@test.com',
        accountStatus,
        activeRoles: [UserRole.ADMIN],
      },
    });
  };

  const dummySoilDevice = {
    id: 'dev-uuid-1',
    deviceId: 'DEV-SOIL-001',
    name: 'Soil Device 1',
    deviceType: DeviceType.SOIL_NODE,
    accountStatus: 'ACTIVE',
    connectionStatus: DeviceConnectionStatus.ONLINE,
    lastSeenAt: new Date('2026-08-02T18:00:00Z'),
  };

  const dummyWaterDevice = {
    id: 'dev-uuid-2',
    deviceId: 'DEV-WATER-001',
    name: 'Water Quality Device 1',
    deviceType: DeviceType.WATER_QUALITY_NODE,
    accountStatus: 'ACTIVE',
    connectionStatus: DeviceConnectionStatus.ONLINE,
    lastSeenAt: new Date('2026-08-02T18:00:00Z'),
  };

  describe('Date Range Validation', () => {
    it('returns 400 INVALID_DATE_RANGE when from > to', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-08-10T00:00:00Z&to=2026-08-01T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('returns 400 DATE_RANGE_EXCEEDED when requested range exceeds 31 days', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-01-01T00:00:00Z&to=2026-03-01T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('DATE_RANGE_EXCEEDED');
    });

    it('returns 400 VALIDATION_ERROR when pageSize exceeds 100', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?pageSize=500',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 INVALID_DATE_RANGE when invalid date string is passed', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=not-a-date',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('RBAC & Auth Verification', () => {
    it('returns 401 when no session is provided', async () => {
      mockValidateSession.mockResolvedValue(null);
      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not ACTIVE', async () => {
      mockAdminSession(AccountStatus.PENDING_APPROVAL);
      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      expect(response.status).toBe(403);
    });

    it('returns 404 when target device does not exist', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/v1/devices/NON-EXISTENT/monitoring/soil/history',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'NON-EXISTENT' }),
      });
      expect(response.status).toBe(404);
    });

    it('returns 403 when ADMIN queries an unassigned device', async () => {
      mockAdminSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);
      mockFindFirstUserDeviceAccess.mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe('Device Type Domain Isolation (Cross-Domain Rejection)', () => {
    it('returns 400 VALIDATION_ERROR when querying soil history for a water quality node', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-WATER-001/monitoring/soil/history',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-WATER-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('WATER_QUALITY_NODE');
    });

    it('returns 400 VALIDATION_ERROR when querying water history for a soil node', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/water/history',
        AUTH_HEADERS
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('SOIL_NODE');
    });
  });

  describe('Successful Soil History Query (GET /soil/history)', () => {
    it('returns 200 OK with valid series, pagination, and preserves null vs zero semantics', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z&metrics=nitrogen,phosphorus',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.series[0].nitrogen).toBe(0);
      expect(body.data.series[0].phosphorus).toBeNull();
      expect(body.data.pagination.page).toBe(1);
    });

    it('succeeds with pageSize=100 and passes page/pageSize to repository', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?pageSize=100&page=2',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      expect(response.status).toBe(200);
      expect(mockGetSoilHistory).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 100 })
      );
    });

    it('uses last 24 hours as default range when from and to are omitted', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history',
        AUTH_HEADERS
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      const callArgs = mockGetSoilHistory.mock.calls[0][0];
      const fromTime = callArgs.from.getTime();
      const toTime = callArgs.to.getTime();
      const diffHours = (toTime - fromTime) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 1);
    });
  });

  describe('Successful Water History Query (GET /water/history)', () => {
    it('returns 200 OK containing only water-quality metrics (no reservoir metrics)', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-WATER-001/monitoring/water/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-WATER-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.deviceId).toBe('DEV-WATER-001');
      expect(body.data.series[0].tds).toBe(0);
      expect(body.data.series[0].ec).toBeNull();
      expect(body.data.series[0].tankVolume).toBeUndefined();
      expect(body.data.series[0].flowRate).toBeUndefined();
    });

    it('returns 200 OK with empty series when no telemetry records exist in range', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterDevice);
      mockGetWaterHistory.mockResolvedValue({
        deviceId: 'DEV-WATER-001',
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-02T00:00:00.000Z',
        series: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalRecords: 0,
          totalPages: 1,
        },
      });

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-WATER-001/monitoring/water/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-WATER-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.series).toEqual([]);
      expect(body.data.pagination.totalRecords).toBe(0);
    });

    it('returns 200 OK when querying water history with internal UUID', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/dev-uuid-2/monitoring/water/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'dev-uuid-2' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.deviceId).toBe('DEV-WATER-001');
    });

    it('returns 404 when device is not found by repository in history endpoint', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/v1/devices/nonexistent-dev/monitoring/water/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z',
        AUTH_HEADERS
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'nonexistent-dev' }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });
});
