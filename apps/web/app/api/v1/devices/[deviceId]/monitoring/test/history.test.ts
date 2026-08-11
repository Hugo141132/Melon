import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as GET_SOIL_HISTORY } from '../soil/history/route';
import { GET as GET_WATER_HISTORY } from '../water/history/route';
import {
  AccountStatus,
  UserRole,
  DeviceType,
  DeviceConnectionStatus,
} from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

const mockGetDeviceByCanonicalId = vi.fn();
const mockFindFirstUserDeviceAccess = vi.fn().mockResolvedValue(null);
const mockGetSoilHistory = vi.fn().mockResolvedValue(null);
const mockGetWaterHistory = vi.fn().mockResolvedValue(null);

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
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

describe('Historical Monitoring API Endpoints (TASK-0503)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
    mockFindFirstUserDeviceAccess.mockResolvedValue(null);
    mockGetSoilHistory.mockResolvedValue({
      deviceId: 'DEV-SOIL-001',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      interval: 'raw',
      series: [
        {
          timestamp: '2026-08-01T12:00:00.000Z',
          nitrogen: 0, // valid zero
          phosphorus: null, // preserved null
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
          tds: 0, // valid zero
          ec: null, // preserved null
        },
      ],
      pagination: { page: 1, pageSize: 20, totalRecords: 1, totalPages: 1 },
    });
  });

  const mockOwnerSession = () => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: { id: 's-owner', userId: 'owner-id-1', expiresAt: new Date() },
      user: {
        id: 'owner-id-1',
        fullName: 'Owner User',
        email: 'owner@test.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    } as any);
  };

  const mockAdminSession = (accountStatus = AccountStatus.ACTIVE) => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: { id: 's-admin', userId: 'admin-id-1', expiresAt: new Date() },
      user: {
        id: 'admin-id-1',
        fullName: 'Admin User',
        email: 'admin@test.com',
        accountStatus,
        activeRoles: [UserRole.ADMIN],
      },
    } as any);
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

  describe('Date Range Validation', () => {
    it('returns 400 INVALID_DATE_RANGE when from > to', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-08-10T00:00:00Z&to=2026-08-01T00:00:00Z'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('returns 400 DATE_RANGE_EXCEEDED when requested range exceeds 31 days', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-06-01T00:00:00Z&to=2026-08-01T00:00:00Z'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DATE_RANGE_EXCEEDED');
    });

    it('returns 400 VALIDATION_ERROR when pageSize exceeds 100', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?pageSize=101'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 INVALID_DATE_RANGE when invalid date string is passed', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=not-a-date'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('RBAC & Device Access Enforcement', () => {
    it('returns 401 when no session is provided', async () => {
      mockCookieToken = undefined;

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 when user is not ACTIVE', async () => {
      mockAdminSession(AccountStatus.PENDING_APPROVAL);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('returns 404 when target device does not exist', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-NONEXISTENT/monitoring/soil/history'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-NONEXISTENT' }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 403 when ADMIN queries an unassigned device', async () => {
      mockAdminSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);
      mockFindFirstUserDeviceAccess.mockResolvedValue(null); // Unassigned

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });
  });

  describe('Successful Soil History Query (GET /soil/history)', () => {
    it('returns 200 OK with valid series, pagination, and preserves null vs zero semantics', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.deviceId).toBe('DEV-SOIL-001');
      expect(body.data.series.length).toBe(1);
      expect(body.data.series[0].nitrogen).toBe(0); // zero preserved as 0
      expect(body.data.series[0].phosphorus).toBeNull(); // missing value preserved as null
      expect(body.data.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalRecords: 1,
        totalPages: 1,
      });
    });

    it('succeeds with pageSize=100 and passes page/pageSize to repository', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history?page=2&pageSize=100'
      );
      const response = await GET_SOIL_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetSoilHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 100,
        })
      );
    });

    it('uses last 24 hours as default range when from and to are omitted', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/history'
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
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);

      const request = new Request(
        'http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/water/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z'
      );
      const response = await GET_WATER_HISTORY(request, {
        params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }),
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
  });
});
