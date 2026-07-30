import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { PATCH, DELETE } from '../[deviceId]/route';
import { POST as DEACTIVATE } from '../[deviceId]/deactivate/route';
import { AccountStatus, UserRole, DeviceType } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
  }),
}));

const mockGetDevices = vi.fn();
const mockGetDeviceByCanonicalId = vi.fn();
const mockCreateDevice = vi.fn();
const mockUpdateDevice = vi.fn();
const mockDeactivateDevice = vi.fn();
const mockDeleteDevicePermanently = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    prisma: {
      userDeviceAccess: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    DeviceRepository: class {
      getDevices(...args: any[]) {
        return mockGetDevices(...args);
      }
      getDeviceByCanonicalId(...args: any[]) {
        return mockGetDeviceByCanonicalId(...args);
      }
      createDevice(...args: any[]) {
        return mockCreateDevice(...args);
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

describe('Device Registry API Endpoints (TASK-0302)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
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

  const mockAdminSession = () => {
    vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: { id: 's-admin', userId: 'admin-id-1', expiresAt: new Date() },
      user: {
        id: 'admin-id-1',
        fullName: 'Admin User',
        email: 'admin@test.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.ADMIN],
      },
    } as any);
  };

  describe('GET /api/v1/devices', () => {
    it('returns 401 when request is unauthenticated', async () => {
      mockCookieToken = undefined;

      const res = await GET(new Request('http://localhost/api/v1/devices'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns authorized devices for OWNER globally without secret exposure', async () => {
      mockOwnerSession();

      mockGetDevices.mockResolvedValueOnce({
        items: [
          {
            id: 'dev-1',
            deviceId: 'water-node-001',
            name: 'Water Node 1',
            deviceType: DeviceType.WATER_NODE,
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
      expect(json.data[0].deviceId).toBe('water-node-001');
      expect(json.data[0].deviceSecret).toBeUndefined();
    });
  });

  describe('POST /api/v1/devices', () => {
    it('rejects creation attempt by Admin with 403 INSUFFICIENT_PERMISSION', async () => {
      mockAdminSession();

      const req = new Request('http://localhost/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'water-node-002',
          name: 'Water Node 2',
          deviceType: DeviceType.WATER_NODE,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('creates device when requested by Owner', async () => {
      mockOwnerSession();

      const createdDto = {
        id: 'dev-2',
        deviceId: 'water-quality-node-002',
        name: 'Water Quality Node 2',
        deviceType: DeviceType.WATER_QUALITY_NODE,
        accountStatus: 'ACTIVE',
        connectionStatus: 'UNKNOWN',
        capabilities: ['WATER_PH', 'WATER_TDS', 'WATER_EC'],
      };

      mockCreateDevice.mockResolvedValueOnce(createdDto);

      const req = new Request('http://localhost/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'water-quality-node-002',
          name: 'Water Quality Node 2',
          deviceType: DeviceType.WATER_QUALITY_NODE,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.deviceId).toBe('water-quality-node-002');
    });

    it('returns 409 DUPLICATE_DEVICE_ID when deviceId already exists', async () => {
      mockOwnerSession();

      mockCreateDevice.mockRejectedValueOnce(
        new dbModule.DeviceConflictError('Device with deviceId water-node-001 already exists.')
      );

      const req = new Request('http://localhost/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'water-node-001',
          name: 'Water Node 1',
          deviceType: DeviceType.SOIL_NODE,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('DUPLICATE_DEVICE_ID');
    });
  });

  describe('PATCH /api/v1/devices/[deviceId]', () => {
    it('rejects attempt to forge connectionStatus via patch payload', async () => {
      mockOwnerSession();

      const req = new Request('http://localhost/api/v1/devices/water-node-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
          connectionStatus: 'ONLINE', // forbidden field
        }),
      });

      const res = await PATCH(req, { params: { deviceId: 'water-node-001' } });
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

      const res = await DEACTIVATE(req, { params: { deviceId: 'water-node-001' } });
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

      const res = await DELETE(req, { params: { deviceId: 'water-node-001' } });
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

      const res = await DELETE(req, { params: { deviceId: 'water-node-001' } });
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

      const res = await DELETE(req, { params: { deviceId: 'non-existent' } });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });
});
