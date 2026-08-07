import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getCombinedLatestHandler } from '../../app/api/v1/devices/[deviceId]/monitoring/latest/route';
import { GET as getSoilLatestHandler } from '../../app/api/v1/devices/[deviceId]/monitoring/soil/latest/route';
import { GET as getWaterLatestHandler } from '../../app/api/v1/devices/[deviceId]/monitoring/water/latest/route';
import {
  AccountStatus,
  UserRole,
  DeviceAccountStatus,
  DeviceConnectionStatus,
  DeviceType,
  MonitoringStatus,
} from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockValidateSession = vi.fn();
const mockGetDeviceByCanonicalId = vi.fn();
const mockFindFirstUserDeviceAccess = vi.fn();
const mockGetLatestSoilReading = vi.fn();
const mockGetLatestWaterReading = vi.fn();
const mockGetLatestWaterTankReading = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
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

describe('API Integration Test Suite — Monitoring Schema & Data Semantics (TASK-1002)', () => {
  const mockAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Active Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockDeviceUuid = '11111111-1111-4111-8111-111111111111';
  const mockCanonicalDeviceId = 'multi-sensor-node-001';

  const mockActiveDevice = {
    id: mockDeviceUuid,
    deviceId: mockCanonicalDeviceId,
    name: 'Multi Sensor Node 001',
    deviceType: DeviceType.SOIL_NODE,
    accountStatus: DeviceAccountStatus.ACTIVE,
    connectionStatus: DeviceConnectionStatus.ONLINE,
    capabilities: [
      { capability: 'SOIL_TELEMETRY', enabled: true },
      { capability: 'WATER_QUALITY_TELEMETRY', enabled: true },
      { capability: 'RESERVOIR_TELEMETRY', enabled: true },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
    mockValidateSession.mockResolvedValue({ user: mockAdminUser });
    mockGetDeviceByCanonicalId.mockResolvedValue(mockActiveDevice);
    mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-record-1' });
  });

  describe('1. Soil Monitoring Schema & Null Semantics', () => {
    it('returns valid soil telemetry payload matching schema specifications', async () => {
      mockGetLatestSoilReading.mockResolvedValueOnce({
        nitrogen: 45,
        phosphorus: 30,
        potassium: 120,
        temperature: 25.4,
        moisture: 65.2,
        ph: 6.8,
        ec: 1.4,
        status: MonitoringStatus.NORMAL,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/monitoring/soil/latest`
      );
      const res = await getSoilLatestHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.data.nitrogen).toBe(45);
      expect(json.data.data.phosphorus).toBe(30);
      expect(json.data.data.potassium).toBe(120);
      expect(json.data.data.temperature).toBe(25.4);
      expect(json.data.data.moisture).toBe(65.2);
      expect(json.data.data.ph).toBe(6.8);
      expect(json.data.data.ec).toBe(1.4);
      expect(json.data.data.status).toBe('NORMAL');
    });

    it('strictly preserves null semantics for missing/unmeasured soil metrics without defaulting to zero', async () => {
      mockGetLatestSoilReading.mockResolvedValueOnce({
        nitrogen: null,
        phosphorus: null,
        potassium: null,
        temperature: 24.0,
        moisture: 50.0,
        ph: null,
        ec: null,
        status: MonitoringStatus.UNKNOWN,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/monitoring/soil/latest`
      );
      const res = await getSoilLatestHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.data.nitrogen).toBeNull();
      expect(json.data.data.nitrogen).not.toBe(0);
      expect(json.data.data.phosphorus).toBeNull();
      expect(json.data.data.potassium).toBeNull();
      expect(json.data.data.ph).toBeNull();
      expect(json.data.data.ec).toBeNull();
      expect(json.data.data.status).toBe('UNKNOWN');
    });
  });

  describe('2. Water Quality Monitoring Schema & Null Semantics', () => {
    it('returns valid water quality telemetry payload matching schema specifications', async () => {
      mockGetLatestWaterReading.mockResolvedValueOnce({
        ph: 7.2,
        tds: 250,
        ec: 0.5,
        latitude: -6.2,
        longitude: 106.816667,
        status: MonitoringStatus.NORMAL,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });
      mockGetLatestWaterTankReading.mockResolvedValueOnce(null);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/monitoring/water/latest`
      );
      const res = await getWaterLatestHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.data.ph).toBe(7.2);
      expect(json.data.data.tds).toBe(250);
      expect(json.data.data.ec).toBe(0.5);
      expect(json.data.data.status).toBe('NORMAL');
    });

    it('strictly preserves null semantics for missing water quality metrics', async () => {
      mockGetLatestWaterReading.mockResolvedValueOnce({
        ph: 6.9,
        tds: null,
        ec: null,
        status: MonitoringStatus.UNAVAILABLE,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });
      mockGetLatestWaterTankReading.mockResolvedValueOnce(null);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/monitoring/water/latest`
      );
      const res = await getWaterLatestHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.data.tds).toBeNull();
      expect(json.data.data.tds).not.toBe(0);
      expect(json.data.data.ec).toBeNull();
      expect(json.data.data.status).toBe('UNAVAILABLE');
    });
  });

  describe('3. Combined Monitoring Payload', () => {
    it('returns combined latest monitoring payload containing soil and water readings', async () => {
      mockGetLatestSoilReading.mockResolvedValueOnce({
        nitrogen: 50,
        temperature: 26.0,
        status: MonitoringStatus.NORMAL,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });
      mockGetLatestWaterReading.mockResolvedValueOnce({
        ph: 7.1,
        status: MonitoringStatus.NORMAL,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });
      mockGetLatestWaterTankReading.mockResolvedValueOnce({
        tankVolume: 12000,
        flowRate: 500,
        status: MonitoringStatus.NORMAL,
        recordedAt: new Date('2026-08-07T10:00:00Z'),
        receivedAt: new Date('2026-08-07T10:00:00Z'),
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/monitoring/latest`
      );
      const res = await getCombinedLatestHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.soil.data.nitrogen).toBe(50);
      expect(json.data.water.data.ph).toBe(7.1);
      expect(json.data.water.data.tankVolume).toBe(12000);
    });
  });
});
