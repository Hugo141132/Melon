import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getLatestMonitoringHandler } from '../../app/api/v1/devices/[deviceId]/monitoring/latest/route';
import { POST as postFaucetCommandHandler } from '../../app/api/v1/devices/[deviceId]/faucet-commands/route';
import { DELETE as revokeDeviceHandler } from '../../app/api/v1/users/[userId]/devices/[deviceId]/route';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
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
const mockUserDeviceAccessFindFirst = vi.fn();
const mockGetLatestSoilReading = vi.fn();
const mockGetLatestWaterReading = vi.fn();
const mockGetLatestWaterTankReading = vi.fn();
const mockCreateFaucetCommand = vi.fn();
const mockRevokeDeviceAssignment = vi.fn();

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    validateSession: (...args: any[]) => mockValidateSession(...args),
    prisma: {
      userDeviceAccess: {
        findFirst: (...args: any[]) => mockUserDeviceAccessFindFirst(...args),
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
    FaucetCommandRepository: class {
      createCommand(...args: any[]) {
        return mockCreateFaucetCommand(...args);
      }
    },
    DeviceAssignmentRepository: class {
      revokeDeviceAssignment(...args: any[]) {
        return mockRevokeDeviceAssignment(...args);
      }
    },
  };
});

describe('API Integration Test Suite — Device Isolation & Authorization (TASK-1002)', () => {
  const mockAssignedAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Assigned Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockOwnerUser = {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Owner User',
    email: 'owner@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  const mockAssignedDeviceId = '11111111-1111-4111-8111-111111111111';
  const mockUnassignedDeviceId = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_FAUCET_CONTROL = 'true';
    mockCookieToken = 'valid-token';
    mockValidateSession.mockResolvedValue({ user: mockAssignedAdminUser });
  });

  describe('1. Assigned Device Access (Permitted)', () => {
    beforeEach(() => {
      mockGetDeviceByCanonicalId.mockResolvedValue({
        id: mockAssignedDeviceId,
        deviceId: 'DEV-001',
        name: 'Greenhouse 1',
        deviceType: 'SOIL_NODE',
        isControllable: true,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['FAUCET_CONTROL'],
      });
      mockUserDeviceAccessFindFirst.mockResolvedValue({
        id: 'assign-001',
        userId: mockAssignedAdminUser.id,
        deviceId: mockAssignedDeviceId,
      });
    });

    it('allows Admin to query latest monitoring data for assigned device', async () => {
      mockGetLatestSoilReading.mockResolvedValueOnce({
        nitrogen: 45,
        phosphorus: 30,
        potassium: 80,
        recordedAt: new Date(),
        receivedAt: new Date(),
      });
      mockGetLatestWaterReading.mockResolvedValueOnce({
        waterPh: 6.5,
        waterTds: 450,
        recordedAt: new Date(),
        receivedAt: new Date(),
      });
      mockGetLatestWaterTankReading.mockResolvedValueOnce({
        tankVolume: 5000,
        flowRate: 120,
        recordedAt: new Date(),
        receivedAt: new Date(),
      });

      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockAssignedDeviceId}/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: mockAssignedDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.soil.data.nitrogen).toBe(45);
      expect(json.data.water.data.tankVolume).toBe(5000);
    });

    it('allows Admin to execute faucet command on assigned controllable device', async () => {
      mockCreateFaucetCommand.mockResolvedValueOnce({
        commandId: 'cmd-100',
        deviceId: mockAssignedDeviceId,
        phase: 1,
        targetVolumeMl: 300,
        status: 'QUEUED',
        idempotencyKey: 'idem-key-100',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockAssignedDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': 'idem-key-100',
            Cookie: 'session_token=valid-token',
          },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 10 }),
        }
      );

      const res = await postFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockAssignedDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.commandId).toBe('cmd-100');
    });
  });

  describe('2. Unassigned Device Isolation (Forbidden)', () => {
    beforeEach(() => {
      mockGetDeviceByCanonicalId.mockResolvedValue({
        id: mockUnassignedDeviceId,
        deviceId: 'DEV-999',
        name: 'Greenhouse Unassigned',
        deviceType: 'SOIL_NODE',
        isControllable: true,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['FAUCET_CONTROL'],
      });
      mockUserDeviceAccessFindFirst.mockResolvedValue(null);
    });

    it('denies monitoring queries on unassigned device with 403 DEVICE_NOT_ASSIGNED', async () => {
      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockUnassignedDeviceId}/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: mockUnassignedDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('denies faucet command execution on unassigned device with 403 DEVICE_NOT_ASSIGNED', async () => {
      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockUnassignedDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': 'idem-key-999',
            Cookie: 'session_token=valid-token',
          },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await postFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockUnassignedDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('prevents URL parameter tampering to access unassigned devices', async () => {
      const req = new Request(
        `http://localhost:3000/api/v1/devices/tampered-device-id/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: 'tampered-device-id' }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });
  });

  describe('3. Revocation of Device Assignment', () => {
    it('immediately revokes device access when Owner calls DELETE /api/v1/users/[userId]/devices/[deviceId]', async () => {
      mockValidateSession.mockResolvedValueOnce({ user: mockOwnerUser });
      mockRevokeDeviceAssignment.mockResolvedValueOnce(true);

      const req = new Request(
        `http://localhost:3000/api/v1/users/${mockAssignedAdminUser.id}/devices/${mockAssignedDeviceId}`,
        { method: 'DELETE', headers: { Cookie: 'session_token=valid-token' } }
      );

      const res = await revokeDeviceHandler(req, {
        params: Promise.resolve({
          userId: mockAssignedAdminUser.id,
          deviceId: mockAssignedDeviceId,
        }),
      });

      expect(res.status).toBe(204);

      mockValidateSession.mockResolvedValueOnce({ user: mockAssignedAdminUser });
      mockGetDeviceByCanonicalId.mockResolvedValueOnce({
        id: mockAssignedDeviceId,
        deviceId: 'DEV-001',
        connectionStatus: 'ONLINE',
      });
      mockUserDeviceAccessFindFirst.mockResolvedValueOnce(null);

      const reqAfterRevoke = new Request(
        `http://localhost:3000/api/v1/devices/${mockAssignedDeviceId}/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const resAfterRevoke = await getLatestMonitoringHandler(reqAfterRevoke, {
        params: Promise.resolve({ deviceId: mockAssignedDeviceId }),
      });
      const jsonAfterRevoke = await resAfterRevoke.json();

      expect(resAfterRevoke.status).toBe(403);
      expect(jsonAfterRevoke.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });
  });
});
