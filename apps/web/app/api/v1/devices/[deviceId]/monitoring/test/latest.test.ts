import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as GET_LATEST } from '../latest/route';
import { GET as GET_SOIL_LATEST } from '../soil/latest/route';
import { GET as GET_WATER_LATEST } from '../water/latest/route';
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
const mockGetLatestSoilReading = vi.fn().mockResolvedValue(null);
const mockGetLatestWaterReading = vi.fn().mockResolvedValue(null);
const mockGetLatestWaterTankReading = vi.fn().mockResolvedValue(null);

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
      getLatestSoilReading(...args: any[]) {
        return mockGetLatestSoilReading(...args);
      }
      getLatestWaterReading(...args: any[]) {
        return mockGetLatestWaterReading(...args);
      }
      getLatestWaterTankReading(...args: any[]) {
        return mockGetLatestWaterTankReading(...args);
      }
    },
  };
});

describe('Latest Monitoring API Endpoints (TASK-0501)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
    mockFindFirstUserDeviceAccess.mockResolvedValue(null);
    mockGetLatestSoilReading.mockResolvedValue(null);
    mockGetLatestWaterReading.mockResolvedValue(null);
    mockGetLatestWaterTankReading.mockResolvedValue(null);
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

  const dummyWaterTankDevice = {
    id: 'dev-uuid-2',
    deviceId: 'water-tank-node-3uufzi',
    name: 'Water Tank Device 1',
    deviceType: DeviceType.WATER_TANK_NODE,
    accountStatus: 'ACTIVE',
    connectionStatus: DeviceConnectionStatus.ONLINE,
    lastSeenAt: new Date('2026-08-02T18:00:00Z'),
  };

  describe('GET /api/v1/devices/[deviceId]/monitoring/soil/latest', () => {
    it('returns 401 when unauthenticated', async () => {
      mockCookieToken = undefined;
      const res = await GET_SOIL_LATEST(
        new Request('http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/latest'),
        { params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }) }
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 404 when device is not found', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const res = await GET_SOIL_LATEST(
        new Request('http://localhost/api/v1/devices/DEV-NONEXISTENT/monitoring/soil/latest'),
        { params: Promise.resolve({ deviceId: 'DEV-NONEXISTENT' }) }
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 403 when Admin accesses unassigned device', async () => {
      mockAdminSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);
      mockFindFirstUserDeviceAccess.mockResolvedValue(null);

      const res = await GET_SOIL_LATEST(
        new Request('http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/latest'),
        { params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }) }
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('returns 200 with soil telemetry data for assigned Admin, preserving 0 and null values', async () => {
      mockAdminSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);
      mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-1' });
      mockGetLatestSoilReading.mockResolvedValue({
        id: 'reading-1',
        deviceId: 'dev-uuid-1',
        recordedAt: new Date('2026-08-02T17:59:00Z'),
        receivedAt: new Date('2026-08-02T18:00:00Z'),
        nitrogen: 0, // Numeric zero must be preserved as 0
        phosphorus: 15,
        potassium: null, // Null must be preserved as null
        temperature: 25.5,
        moisture: 60.0,
        ph: 6.8,
        ec: 1.2,
        status: 'NORMAL',
      });

      const res = await GET_SOIL_LATEST(
        new Request('http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/soil/latest'),
        { params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('DEV-SOIL-001');
      expect(json.data.isStale).toBe(false);
      expect(json.data.data.nitrogen).toBe(0);
      expect(json.data.data.phosphorus).toBe(15);
      expect(json.data.data.potassium).toBeNull();
      expect(json.data.data.temperature).toBe(25.5);
      expect(json.data.data.status).toBe('NORMAL');
    });
  });

  describe('GET /api/v1/devices/[deviceId]/monitoring/water/latest', () => {
    it('returns 200 for Owner, returning only tankVolume and flowRate for WATER_TANK_NODE with ph/tds/ec as null and no GPS coords', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterTankDevice);
      mockGetLatestWaterTankReading.mockResolvedValue({
        id: 'res-1',
        deviceId: 'dev-uuid-2',
        recordedAt: new Date('2026-08-02T17:59:00Z'),
        receivedAt: new Date('2026-08-02T18:00:00Z'),
        tankVolume: 850.5,
        flowRate: 0, // Numeric zero preserved
        status: 'NORMAL',
      });

      const res = await GET_WATER_LATEST(
        new Request(
          'http://localhost/api/v1/devices/water-tank-node-3uufzi/monitoring/water/latest'
        ),
        { params: Promise.resolve({ deviceId: 'water-tank-node-3uufzi' }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.data.ph).toBeNull();
      expect(json.data.data.tds).toBeNull();
      expect(json.data.data.ec).toBeNull();
      expect(json.data.data.tankVolume).toBe(850.5);
      expect(json.data.data.flowRate).toBe(0);
      expect(json.data.data.latitude).toBeUndefined();
      expect(json.data.data.longitude).toBeUndefined();
    });

    it('regression: returns 200 for assigned ADMIN requesting water-tank-node-3uufzi using non-UUID canonical deviceId string', async () => {
      mockAdminSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummyWaterTankDevice);
      mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-2' });
      mockGetLatestWaterTankReading.mockResolvedValue({
        id: 'res-2',
        deviceId: 'dev-uuid-2',
        recordedAt: new Date('2026-08-02T17:59:00Z'),
        receivedAt: new Date('2026-08-02T18:00:00Z'),
        tankVolume: 1200.0,
        flowRate: 15.2,
        status: 'NORMAL',
      });

      const res = await GET_WATER_LATEST(
        new Request(
          'http://localhost/api/v1/devices/water-tank-node-3uufzi/monitoring/water/latest'
        ),
        { params: Promise.resolve({ deviceId: 'water-tank-node-3uufzi' }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('water-tank-node-3uufzi');
      expect(json.data.data.tankVolume).toBe(1200.0);
      expect(json.data.data.flowRate).toBe(15.2);
      expect(json.data.data.ph).toBeNull();
      expect(json.data.data.tds).toBeNull();
      expect(json.data.data.ec).toBeNull();
      expect(json.data.data.latitude).toBeUndefined();
      expect(json.data.data.longitude).toBeUndefined();
    });
  });

  describe('GET /api/v1/devices/[deviceId]/monitoring/latest', () => {
    it('returns combined latest snapshot for Owner', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValue(dummySoilDevice);
      mockGetLatestSoilReading.mockResolvedValue({
        id: 'reading-1',
        deviceId: 'dev-uuid-1',
        recordedAt: new Date('2026-08-02T17:59:00Z'),
        receivedAt: new Date('2026-08-02T18:00:00Z'),
        nitrogen: 10,
        phosphorus: 20,
        potassium: 30,
        temperature: 24,
        moisture: 55,
        ph: 6.5,
        ec: 1.1,
        status: 'NORMAL',
      });

      const res = await GET_LATEST(
        new Request('http://localhost/api/v1/devices/DEV-SOIL-001/monitoring/latest'),
        { params: Promise.resolve({ deviceId: 'DEV-SOIL-001' }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('DEV-SOIL-001');
      expect(json.data.deviceType).toBe(DeviceType.SOIL_NODE);
      expect(json.data.soil).not.toBeNull();
      expect(json.data.soil.data.nitrogen).toBe(10);
      expect(json.data.water).toBeNull();
    });
  });
});
