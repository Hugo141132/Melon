import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getLatestPredictionHandler } from '../../app/api/v1/devices/[deviceId]/predictions/latest/route';
import {
  AccountStatus,
  UserRole,
  DeviceType,
  SoilPredictionDto,
  WaterPredictionDto,
} from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-session-token';

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockValidateSession = vi.fn();
const mockGetDeviceByCanonicalId = vi.fn();
const mockGetActiveExternalDeviceId = vi.fn();
const mockFindFirstUserDeviceAccess = vi.fn();
const mockGetLatestSoilPrediction = vi.fn();
const mockGetLatestWaterPrediction = vi.fn();

const mockPredictionClient = {
  getLatestSoilPrediction: (...args: any[]) => mockGetLatestSoilPrediction(...args),
  getLatestWaterPrediction: (...args: any[]) => mockGetLatestWaterPrediction(...args),
};

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
      getActiveExternalDeviceId(...args: any[]) {
        return mockGetActiveExternalDeviceId(...args);
      }
    },
    getExternalPredictionClient: () => mockPredictionClient,
  };
});

describe('API Unit Test Suite — Protected Prediction Endpoint (TASK-0413 Phase B)', () => {
  const mockOwnerUser = {
    id: 'owner-uuid-1111',
    fullName: 'Owner User',
    email: 'owner@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  const mockAdminUser = {
    id: 'admin-uuid-2222',
    fullName: 'Assigned Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockSoilDevice = {
    id: '11111111-1111-4111-8111-111111111111',
    deviceId: 'soil-node-jvbkdbv',
    clientId: 'melon-esp32-tanah1',
    name: 'Bedeng Melon 1',
    deviceType: DeviceType.SOIL_NODE,
    siteId: 'site-default',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    capabilities: ['SOIL_MONITORING'],
  };

  const mockWaterDevice = {
    id: '22222222-2222-4222-8222-222222222222',
    deviceId: 'water-quality-node-quiua',
    clientId: 'melon-esp32-air1',
    name: 'Tandon Air Nutrisi',
    deviceType: DeviceType.WATER_QUALITY_NODE,
    siteId: 'site-default',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    capabilities: ['WATER_QUALITY_MONITORING'],
  };

  const mockTankDevice = {
    id: '33333333-3333-4333-8333-333333333333',
    deviceId: 'water-tank-node-alpha',
    clientId: 'melon-esp32-tank1',
    name: 'Tandon Utama',
    deviceType: DeviceType.WATER_TANK_NODE,
    siteId: 'site-default',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    capabilities: ['WATER_TANK_MONITORING'],
  };

  const mockSoilPrediction: SoilPredictionDto = {
    id: 'pred-soil-uuid-1234',
    deviceId: 'melon002', // external ML device identifier
    readingId: null,
    predictedClass: 'optimal',
    confidence: 0.905,
    features: {
      n: 55,
      p: 32,
      k: 65,
      temp: 28.5,
      moisture: 72.0,
      ph: 6.5,
      ec: 2.1,
    },
    actions: {
      module: 'soil',
      classification: 'optimal',
      summary: 'Kondisi tanah baik. Pertahankan pola perawatan.',
      issues: [],
      farmer_action: [],
    },
    summary: 'Kondisi tanah baik. Pertahankan pola perawatan.',
    farmerAction: [],
    issues: [],
    rawRecommendation: '{"module":"soil","classification":"optimal"}',
    modelVersion: 'v1.0.0',
    createdAt: '2026-09-18T00:33:06.431Z',
  };

  const mockWaterPrediction: WaterPredictionDto = {
    id: 'pred-water-uuid-5678',
    deviceId: 'water001', // external ML device identifier
    readingId: null,
    predictedClass: 'kritis',
    confidence: 0.895,
    features: {
      ph: 7.8,
      tds: 4900,
      ec: 5.8,
    },
    actions: {
      module: 'water',
      classification: 'kritis',
      summary: 'Ditemukan 2 masalah kualitas air.',
      issues: [
        {
          parameter: 'EC air',
          value: 5.8,
          problem: 'Kandungan garam/nutrisi terlalu tinggi',
          impact: 'Dapat menyebabkan tanaman stres',
        },
      ],
      farmer_action: ['Kurangi konsentrasi pupuk nutrisi'],
    },
    summary: 'Ditemukan 2 masalah kualitas air.',
    farmerAction: ['Kurangi konsentrasi pupuk nutrisi'],
    issues: [
      {
        parameter: 'EC air',
        value: 5.8,
        problem: 'Kandungan garam/nutrisi terlalu tinggi',
        impact: 'Dapat menyebabkan tanaman stres',
      },
    ],
    rawRecommendation: '{"module":"water","classification":"kritis"}',
    modelVersion: 'v1.0.0',
    createdAt: '2026-09-18T01:43:44.798Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-session-token';
    mockValidateSession.mockResolvedValue({
      user: mockOwnerUser,
    });
    mockGetDeviceByCanonicalId.mockResolvedValue(mockSoilDevice);
    mockGetActiveExternalDeviceId.mockResolvedValue(null);
    mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-1' });
    mockGetLatestSoilPrediction.mockResolvedValue(mockSoilPrediction);
    mockGetLatestWaterPrediction.mockResolvedValue(mockWaterPrediction);
  });

  describe('1. Authentication & Security Enforcement', () => {
    it('returns 401 UNAUTHENTICATED when session token cookie is missing', async () => {
      mockCookieToken = undefined;
      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 INVALID_SESSION when session validation fails', async () => {
      mockValidateSession.mockResolvedValueOnce(null);
      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_SESSION');
    });

    it('returns 403 DEVICE_NOT_ASSIGNED when Admin lacks access to the device', async () => {
      mockValidateSession.mockResolvedValueOnce({
        user: mockAdminUser,
      });
      mockFindFirstUserDeviceAccess.mockResolvedValueOnce(null);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });
  });

  describe('2. Device Resolution & 404 Handling', () => {
    it('returns 404 DEVICE_NOT_FOUND when device does not exist in Melon database', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/v1/devices/non-existent/predictions/latest');
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'non-existent' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('resolves device correctly when queried by UUID', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockSoilDevice.id}/predictions/latest`
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: mockSoilDevice.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe(mockSoilDevice.deviceId);
      expect(mockGetDeviceByCanonicalId).toHaveBeenCalledWith(mockSoilDevice.id);
    });
  });

  describe('3. Domain Resolution & Canonical Prediction DTO', () => {
    it('serves soil prediction for SOIL_NODE and masks external device ID to Melon canonical ID', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetLatestSoilPrediction.mockResolvedValueOnce(mockSoilPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.predictedClass).toBe('optimal');
      expect(json.data.confidence).toBe(0.905);
      // Canonical device ID masked to Melon's device.deviceId, NOT external melon002
      expect(json.data.deviceId).toBe('soil-node-jvbkdbv');
      expect(json.data.features.n).toBe(55);
      expect(json.data.rawRecommendation).toBeUndefined();
      expect(mockGetLatestSoilPrediction).toHaveBeenCalledWith('soil-node-jvbkdbv');
    });

    it('serves water quality prediction for WATER_QUALITY_NODE and masks external device ID', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockWaterDevice);
      mockGetLatestWaterPrediction.mockResolvedValueOnce(mockWaterPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/water-quality-node-quiua/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'water-quality-node-quiua' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.predictedClass).toBe('kritis');
      expect(json.data.confidence).toBe(0.895);
      expect(json.data.deviceId).toBe('water-quality-node-quiua');
      expect(json.data.issues[0].parameter).toBe('EC air');
      expect(json.data.rawRecommendation).toBeUndefined();
      expect(mockGetLatestWaterPrediction).toHaveBeenCalledWith('water-quality-node-quiua');
    });

    it('ignores public forceRefresh query parameter to preserve server-side caching', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetLatestSoilPrediction.mockResolvedValueOnce(mockSoilPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest?forceRefresh=true'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // forceRefresh is ignored from public API; client is called without forced bypass
      expect(mockGetLatestSoilPrediction).toHaveBeenCalledWith('soil-node-jvbkdbv');
    });

    it('returns safe response with data: null and UNSUPPORTED status for WATER_TANK_NODE', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockTankDevice);

      const req = new Request(
        'http://localhost/api/v1/devices/water-tank-node-alpha/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'water-tank-node-alpha' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
      expect(json.meta.status).toBe('UNSUPPORTED');
      expect(json.meta.message).toContain('WATER_TANK_NODE');
    });
  });

  describe('4. Fail-Safe Unavailable & Malformed Prediction Handling', () => {
    it('returns safe response with data: null and UNAVAILABLE status when prediction is unavailable', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetLatestSoilPrediction.mockResolvedValue(null);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
      expect(json.meta.status).toBe('UNAVAILABLE');
      // Must not fabricate NORMAL status or dummy timestamps
      expect(json.data?.predictedClass).toBeUndefined();
    });

    it('returns safe response with data: null when prediction row was malformed and caught fail-safe', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockWaterDevice);
      // Malformed external response causes client to safely return null
      mockGetLatestWaterPrediction.mockResolvedValue(null);

      const req = new Request(
        'http://localhost/api/v1/devices/water-quality-node-quiua/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'water-quality-node-quiua' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
      expect(json.meta.status).toBe('UNAVAILABLE');
    });
  });

  describe('5. Credential & External Leakage Prevention', () => {
    it('never exposes external Supabase URL, service keys, or secret tokens in response', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetLatestSoilPrediction.mockResolvedValueOnce(mockSoilPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const rawBody = await res.text();

      // Ensure no external project URL, anon key, or service role secrets are exposed
      expect(rawBody).not.toContain('https://styjuynxuykvujnnqxos.supabase.co');
      expect(rawBody).not.toContain('supabase.co');
      expect(rawBody).not.toContain('anon');
      expect(rawBody).not.toContain('service_role');
      expect(rawBody).not.toContain('EXTERNAL_ML');
      expect(rawBody).not.toContain('rawRecommendation');
      expect(rawBody).not.toContain('soil_predictions');
      expect(rawBody).not.toContain('water_predictions');
      // Ensure external hardware ID 'melon002' is masked to Melon's canonical ID 'soil-node-jvbkdbv'
      expect(rawBody).not.toContain('"deviceId":"melon002"');
      expect(rawBody).toContain('"deviceId":"soil-node-jvbkdbv"');
    });
  });

  describe('6. Dynamic External Mapping Resolution (TASK-0413 database-driven mapping)', () => {
    it('dynamically queries DeviceRepository for active external mapping and passes resolved ID to client', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetActiveExternalDeviceId.mockResolvedValueOnce('melon002');
      mockGetLatestSoilPrediction.mockResolvedValueOnce(mockSoilPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // Repository called to resolve active external mapping
      expect(mockGetActiveExternalDeviceId).toHaveBeenCalledWith(
        mockSoilDevice.id,
        'SOIL',
        'EXTERNAL_ML'
      );
      // Prediction client called with dynamically resolved external device ID 'melon002'
      expect(mockGetLatestSoilPrediction).toHaveBeenCalledWith('melon002');
      // Public response DTO remains masked to canonical deviceId
      expect(json.data.deviceId).toBe('soil-node-jvbkdbv');
    });

    it('dynamically resolves water node external mapping to water001 and masks response', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockWaterDevice);
      mockGetActiveExternalDeviceId.mockResolvedValueOnce('water001');
      mockGetLatestWaterPrediction.mockResolvedValueOnce(mockWaterPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/water-quality-node-quiua/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'water-quality-node-quiua' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetActiveExternalDeviceId).toHaveBeenCalledWith(
        mockWaterDevice.id,
        'WATER',
        'EXTERNAL_ML'
      );
      expect(mockGetLatestWaterPrediction).toHaveBeenCalledWith('water001');
      expect(json.data.deviceId).toBe('water-quality-node-quiua');
    });

    it('falls back to device.deviceId when dynamic mapping is not found in database', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockSoilDevice);
      mockGetActiveExternalDeviceId.mockResolvedValueOnce(null);
      mockGetLatestSoilPrediction.mockResolvedValueOnce(mockSoilPrediction);

      const req = new Request(
        'http://localhost/api/v1/devices/soil-node-jvbkdbv/predictions/latest'
      );
      const res = await getLatestPredictionHandler(req, {
        params: Promise.resolve({ deviceId: 'soil-node-jvbkdbv' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetActiveExternalDeviceId).toHaveBeenCalledWith(
        mockSoilDevice.id,
        'SOIL',
        'EXTERNAL_ML'
      );
      // Falls back to device.deviceId
      expect(mockGetLatestSoilPrediction).toHaveBeenCalledWith('soil-node-jvbkdbv');
    });
  });
});
