import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../route';
import { GET as GET_DETAIL, PATCH, DELETE } from '../[deviceId]/route';
import { POST as DEACTIVATE } from '../[deviceId]/deactivate/route';
import { AccountStatus, UserRole, DeviceType } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockGetDevices = vi.fn();
const mockGetDeviceByCanonicalId = vi.fn();
const mockUpdateDevice = vi.fn();
const mockDeactivateDevice = vi.fn();
const mockDeleteDevicePermanently = vi.fn();
const mockFindManyUserDeviceAccess = vi.fn().mockResolvedValue([]);
const mockFindFirstUserDeviceAccess = vi.fn().mockResolvedValue(null);

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    prisma: {
      userDeviceAccess: {
        findMany: (...args: any[]) => mockFindManyUserDeviceAccess(...args),
        findFirst: (...args: any[]) => mockFindFirstUserDeviceAccess(...args),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
    DeviceRepository: class {
      getDevices(...args: any[]) {
        return mockGetDevices(...args);
      }
      getDeviceByCanonicalId(...args: any[]) {
        return mockGetDeviceByCanonicalId(...args);
      }
      updateDevice(...args: any[]) {
        return mockUpdateDevice(...args);
      }
      deactivateDevice(...args: any[]) {
        return mockDeactivateDevice(...args);
      }
      deleteDevicePermanently(...args: any[]) {
        return mockDeleteDevicePermanently(...args);
      }
    },
  };
});

describe('Device Registry API Endpoints (TASK-0302 & TASK-0305)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
    mockFindManyUserDeviceAccess.mockResolvedValue([]);
    mockFindFirstUserDeviceAccess.mockResolvedValue(null);
    delete process.env.ENABLE_FAUCET_CONTROL;
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

  describe('GET /api/v1/devices (TASK-0305 Authorised Device List)', () => {
    it('returns 401 when request is unauthenticated', async () => {
      mockCookieToken = undefined;

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 ACCOUNT_NOT_ACTIVE when user account is PENDING_APPROVAL', async () => {
      mockAdminSession(AccountStatus.PENDING_APPROVAL);

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('returns authorized devices for OWNER globally with canonical deviceId and permissions DTO', async () => {
      mockOwnerSession();

      mockGetDevices.mockResolvedValueOnce({
        items: [
          {
            id: 'dev-1',
            deviceId: 'water-node-001',
            name: 'Water Node 1',
            deviceType: DeviceType.WATER_QUALITY_NODE,
            accountStatus: 'ACTIVE',
            connectionStatus: 'ONLINE',
            capabilities: ['WATER_TELEMETRY'],
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].id).toBe('dev-1');
      expect(json.data[0].deviceId).toBe('water-node-001');
      expect(json.data[0].deviceSecret).toBeUndefined();
      expect(json.data[0].permissions).toEqual({
        canView: true,
        canControl: false,
      });
      // Verifies Owner query does not filter by user assignments
      expect(mockGetDevices).toHaveBeenCalledWith(expect.anything(), undefined);
    });

    it('filters devices strictly to active assignments and strictly conceals canonical deviceId for ADMIN (DEC-DEV-028)', async () => {
      mockAdminSession();

      mockFindManyUserDeviceAccess.mockResolvedValueOnce([{ deviceId: 'dev-assigned-uuid' }]);

      mockGetDevices.mockResolvedValueOnce({
        items: [
          {
            id: 'dev-assigned-uuid',
            deviceId: 'water-tank-node-001',
            name: 'Tank Node 1',
            deviceType: DeviceType.WATER_TANK_NODE,
            accountStatus: 'ACTIVE',
            connectionStatus: 'ONLINE',
            capabilities: ['WATER_TANK_VOLUME', 'FLOW_MONITORING', 'FAUCET_CONTROL'],
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetDevices).toHaveBeenCalledWith(expect.anything(), ['dev-assigned-uuid']);
      expect(json.data[0].id).toBe('dev-assigned-uuid');
      expect(json.data[0].name).toBe('Tank Node 1');
      // DEC-DEV-028: Canonical deviceId is concealed from Admin users
      expect(json.data[0].deviceId).toBeUndefined();
      expect(json.data[0].permissions).toBeDefined();
      expect(json.data[0].permissions.canView).toBe(true);
    });

    it('returns empty list for ADMIN with no active assignments', async () => {
      mockAdminSession();
      mockFindManyUserDeviceAccess.mockResolvedValueOnce([]);

      mockGetDevices.mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      });

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
      expect(mockGetDevices).toHaveBeenCalledWith(expect.anything(), []);
    });

    it('returns 422 VALIDATION_ERROR when query parameters are invalid', async () => {
      mockOwnerSession();

      const res = await GET(new Request('http://localhost/api/v1/devices?pageSize=999'));
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/devices/[deviceId] (TASK-0305 Device Detail)', () => {
    it('returns 401 when request is unauthenticated', async () => {
      mockCookieToken = undefined;

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/devices/water-node-001'), {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 ACCOUNT_NOT_ACTIVE when user account is PENDING_APPROVAL', async () => {
      mockAdminSession(AccountStatus.PENDING_APPROVAL);

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/devices/water-node-001'), {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('returns 404 DEVICE_NOT_FOUND when device does not exist', async () => {
      mockOwnerSession();
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(null);

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/devices/non-existent'), {
        params: Promise.resolve({ deviceId: 'non-existent' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 200 OK with canonical deviceId and permissions for OWNER for any existing device', async () => {
      mockOwnerSession();
      const mockDev = {
        id: 'dev-1',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['WATER_PH'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockDev);

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/devices/water-node-001'), {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('dev-1');
      expect(json.data.deviceId).toBe('water-node-001');
      expect(json.data.permissions).toEqual({ canView: true, canControl: false });
    });

    it('returns 200 OK for ADMIN when device is actively assigned, concealing canonical deviceId (DEC-DEV-028)', async () => {
      mockAdminSession();
      const mockDev = {
        id: 'dev-1',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['WATER_PH'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockDev);
      mockFindFirstUserDeviceAccess.mockResolvedValueOnce({
        id: 'assignment-1',
        userId: 'admin-id-1',
        deviceId: 'dev-1',
        revokedAt: null,
      });

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/devices/water-node-001'), {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('dev-1');
      expect(json.data.name).toBe('Water Node 1');
      // DEC-DEV-028: Canonical deviceId is concealed from Admin users
      expect(json.data.deviceId).toBeUndefined();
      expect(json.data.permissions).toEqual({ canView: true, canControl: false });
    });

    it('returns 403 DEVICE_NOT_ASSIGNED for ADMIN when device is unassigned or assignment is revoked', async () => {
      mockAdminSession();
      const mockDev = {
        id: 'dev-2',
        deviceId: 'unassigned-node-002',
        name: 'Unassigned Node',
        deviceType: DeviceType.SOIL_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['SOIL_NITROGEN'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockDev);
      // findFirst returns null because revokedAt !== null or no assignment row exists
      mockFindFirstUserDeviceAccess.mockResolvedValueOnce(null);

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/devices/unassigned-node-002'),
        { params: Promise.resolve({ deviceId: 'unassigned-node-002' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('returns 200 OK for ADMIN when looking up device by UUID id, concealing canonical deviceId (DEC-DEV-028)', async () => {
      mockAdminSession();
      const mockDev = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['WATER_PH'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockDev);
      mockFindFirstUserDeviceAccess.mockResolvedValueOnce({
        id: 'assignment-1',
        userId: 'admin-id-1',
        deviceId: '11111111-1111-1111-1111-111111111111',
        revokedAt: null,
      });

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/devices/11111111-1111-1111-1111-111111111111'),
        { params: Promise.resolve({ deviceId: '11111111-1111-1111-1111-111111111111' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('11111111-1111-1111-1111-111111111111');
      expect(json.data.name).toBe('Water Node 1');
      expect(json.data.deviceId).toBeUndefined();
      expect(json.data.permissions).toEqual({ canView: true, canControl: false });
    });

    it('returns 403 DEVICE_NOT_ASSIGNED for ADMIN attempting IDOR access to unassigned UUID (IDOR mitigation)', async () => {
      mockAdminSession();
      const mockDev = {
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'other-node-002',
        name: 'Other Node',
        deviceType: DeviceType.SOIL_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['SOIL_NITROGEN'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(mockDev);
      mockFindFirstUserDeviceAccess.mockResolvedValueOnce(null);

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/devices/22222222-2222-2222-2222-222222222222'),
        { params: Promise.resolve({ deviceId: '22222222-2222-2222-2222-222222222222' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('evaluates permissions.canControl = true when ENABLE_FAUCET_CONTROL=true and device has FAUCET_CONTROL capability', async () => {
      process.env.ENABLE_FAUCET_CONTROL = 'true';
      mockOwnerSession();

      const tankDevice = {
        id: 'dev-tank',
        deviceId: 'water-tank-node-001',
        name: 'Tank Node',
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['WATER_TANK_VOLUME', 'FAUCET_CONTROL'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(tankDevice);

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/devices/water-tank-node-001'),
        { params: Promise.resolve({ deviceId: 'water-tank-node-001' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.permissions).toEqual({ canView: true, canControl: true });
    });

    it('evaluates permissions.canControl = false when device is DEACTIVATED', async () => {
      process.env.ENABLE_FAUCET_CONTROL = 'true';
      mockOwnerSession();

      const deactivatedTankDevice = {
        id: 'dev-tank',
        deviceId: 'water-tank-node-001',
        name: 'Tank Node',
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: 'DEACTIVATED',
        connectionStatus: 'INACTIVE',
        capabilities: ['WATER_TANK_VOLUME', 'FAUCET_CONTROL'],
      };
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(deactivatedTankDevice);

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/devices/water-tank-node-001'),
        { params: Promise.resolve({ deviceId: 'water-tank-node-001' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.permissions).toEqual({ canView: true, canControl: false });
    });
  });

  describe('PATCH /api/v1/devices/[deviceId] (TASK-0302 / DEC-DEV-028)', () => {
    it('allows Owner to update canonical deviceId and user-facing name', async () => {
      mockOwnerSession();

      const updatedDto = {
        id: 'dev-1',
        deviceId: 'water-node-001-renamed',
        name: 'Renamed Water Node',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['WATER_PH'],
      };
      mockUpdateDevice.mockResolvedValueOnce(updatedDto);

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'water-node-001-renamed',
          name: 'Renamed Water Node',
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('water-node-001-renamed');
      expect(json.data.name).toBe('Renamed Water Node');
      expect(mockUpdateDevice).toHaveBeenCalledWith(
        'water-node-001',
        {
          deviceId: 'water-node-001-renamed',
          name: 'Renamed Water Node',
        },
        'owner-id-1'
      );
    });

    it('denies Admin update attempt with 403 INSUFFICIENT_PERMISSION (DEC-DEV-028)', async () => {
      mockAdminSession();

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Admin Attempted Name',
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
      expect(mockUpdateDevice).not.toHaveBeenCalled();
    });

    it('returns 409 DUPLICATE_DEVICE_ID when target deviceId is already taken by another device', async () => {
      mockOwnerSession();

      mockUpdateDevice.mockRejectedValueOnce(
        new dbModule.DeviceConflictError(
          "Device with canonical deviceId 'existing-node' already exists."
        )
      );

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'existing-node',
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('DUPLICATE_DEVICE_ID');
    });

    it('rejects attempt to forge connectionStatus or server-controlled fields via patch payload', async () => {
      mockOwnerSession();

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
          connectionStatus: 'ONLINE', // forbidden field
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/devices/[deviceId]/deactivate', () => {
    it('deactivates device when called by Owner', async () => {
      mockOwnerSession();

      mockDeactivateDevice.mockResolvedValueOnce({
        id: 'dev-1',
        deviceId: 'water-node-001',
        accountStatus: 'DEACTIVATED',
        connectionStatus: 'INACTIVE',
      });

      const req = new Request('http://localhost/api/v1/devices/water-node-001/deactivate', {
        method: 'POST',
      });

      const res = await DEACTIVATE(req, {
        params: Promise.resolve({ deviceId: 'water-node-001' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.accountStatus).toBe('DEACTIVATED');
      expect(json.data.connectionStatus).toBe('INACTIVE');
    });
  });

  describe('DELETE /api/v1/devices/[deviceId]', () => {
    it('permanently deletes device when requested by Owner', async () => {
      mockOwnerSession();

      mockDeleteDevicePermanently.mockResolvedValueOnce({
        id: 'dev-1',
        deviceId: 'water-node-001',
        name: 'Water Node 1',
      });

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'DELETE',
      });

      const res = await DELETE(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('water-node-001');
    });

    it('rejects delete request by Admin with 403 INSUFFICIENT_PERMISSION', async () => {
      mockAdminSession();

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'DELETE',
      });

      const res = await DELETE(req, { params: Promise.resolve({ deviceId: 'water-node-001' }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('returns 404 DEVICE_NOT_FOUND when device does not exist', async () => {
      mockOwnerSession();

      mockDeleteDevicePermanently.mockRejectedValueOnce(
        new dbModule.DeviceNotFoundError("Device 'non-existent' not found.")
      );

      const req = new Request('http://localhost/api/v1/devices/non-existent', {
        method: 'DELETE',
      });

      const res = await DELETE(req, { params: Promise.resolve({ deviceId: 'non-existent' }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });
});
