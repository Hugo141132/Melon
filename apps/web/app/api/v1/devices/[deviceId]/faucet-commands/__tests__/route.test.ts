import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST, GET } from '../route';
import { GET as GET_COMMAND_DETAIL } from '../[commandId]/route';
import {
  AccountStatus,
  UserRole,
  DeviceAccountStatus,
  DeviceConnectionStatus,
  FaucetCommandStatus,
  DeviceType,
  FaucetCommandAction,
} from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';
import { FaucetCommandConflictError } from '@kebun-melon/database';

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
const mockCreateCommand = vi.fn();
const mockGetCommands = vi.fn();
const mockGetCommandById = vi.fn();

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
    FaucetCommandRepository: class {
      createCommand(...args: any[]) {
        return mockCreateCommand(...args);
      }
      getCommands(...args: any[]) {
        return mockGetCommands(...args);
      }
      getCommandById(...args: any[]) {
        return mockGetCommandById(...args);
      }
    },
  };
});

describe('Faucet Command API Endpoints (TASK-0803)', () => {
  const originalEnv = process.env.ENABLE_FAUCET_CONTROL;

  const mockAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Active Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockOwnerUser = {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Active Owner',
    email: 'owner@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  const mockPendingAdminUser = {
    id: '55555555-5555-4555-8555-555555555555',
    fullName: 'Pending Admin',
    email: 'pending@kebunmelon.id',
    accountStatus: AccountStatus.PENDING_APPROVAL,
    activeRoles: [UserRole.ADMIN],
  };

  const mockDeviceUuid = '11111111-1111-4111-8111-111111111111';
  const mockCanonicalDeviceId = 'water-tank-node-001';

  const mockControllableDevice = {
    id: mockDeviceUuid,
    deviceId: mockCanonicalDeviceId,
    name: 'Water Tank Node 001',
    deviceType: DeviceType.WATER_TANK_NODE,
    accountStatus: DeviceAccountStatus.ACTIVE,
    connectionStatus: DeviceConnectionStatus.ONLINE,
    capabilities: [{ capability: 'FAUCET_CONTROL', enabled: true }],
  };

  const mockCommandRecord = {
    id: '33333333-3333-4333-8333-333333333333',
    commandId: 'cmd-01JXYZ123',
    deviceId: mockDeviceUuid,
    initiatedByUserId: mockAdminUser.id,
    initiatedByRole: UserRole.ADMIN,
    action: FaucetCommandAction.DISPENSE,
    phase: 1,
    plantCount: 1,
    targetVolumeMl: 300,
    actualVolumeMl: null,
    status: FaucetCommandStatus.QUEUED,
    requestedAt: new Date('2026-08-02T10:00:00Z'),
    queuedAt: new Date('2026-08-02T10:00:00Z'),
    sentAt: null,
    acknowledgedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: new Date('2026-08-02T10:05:00Z'),
    failureReasonCode: null,
    idempotencyKey: 'idem-key-001',
    createdAt: new Date('2026-08-02T10:00:00Z'),
    updatedAt: new Date('2026-08-02T10:00:00Z'),
    events: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        faucetCommandId: '33333333-3333-4333-8333-333333333333',
        eventStatus: FaucetCommandStatus.QUEUED,
        messageId: null,
        reasonCode: null,
        actualVolumeMl: null,
        recordedAt: null,
        receivedAt: new Date('2026-08-02T10:00:00Z'),
        metadata: null,
        createdAt: new Date('2026-08-02T10:00:00Z'),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_FAUCET_CONTROL = 'true';
    mockCookieToken = 'valid-token';
    mockValidateSession.mockResolvedValue({ user: mockAdminUser });
    mockGetDeviceByCanonicalId.mockResolvedValue(mockControllableDevice);
    mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-001' });
    mockCreateCommand.mockResolvedValue(mockCommandRecord);
    mockGetCommands.mockResolvedValue({
      items: [mockCommandRecord],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    mockGetCommandById.mockResolvedValue(mockCommandRecord);
  });

  afterEach(() => {
    process.env.ENABLE_FAUCET_CONTROL = originalEnv;
  });

  describe('POST /api/v1/devices/[deviceId]/faucet-commands', () => {
    it('returns 401 UNAUTHENTICATED when session cookie is missing', async () => {
      mockCookieToken = undefined;

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 ACCOUNT_NOT_ACTIVE when user account is PENDING_APPROVAL', async () => {
      mockValidateSession.mockResolvedValue({ user: mockPendingAdminUser });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('returns 403 FAUCET_CONTROL_DISABLED when ENABLE_FAUCET_CONTROL feature flag is disabled', async () => {
      process.env.ENABLE_FAUCET_CONTROL = 'false';

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FAUCET_CONTROL_DISABLED');
    });

    it('returns 404 DEVICE_NOT_FOUND when device does not exist', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const req = new Request(`http://localhost/api/v1/devices/nonexistent-node/faucet-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
        body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
      });

      const res = await POST(req, { params: Promise.resolve({ deviceId: 'nonexistent-node' }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 403 DEVICE_NOT_ASSIGNED when Admin user is not assigned to device', async () => {
      mockFindFirstUserDeviceAccess.mockResolvedValue(null);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('returns 403 DEVICE_NOT_ACTIVE when target device accountStatus is INACTIVE', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValue({
        ...mockControllableDevice,
        accountStatus: DeviceAccountStatus.INACTIVE,
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('DEVICE_NOT_ACTIVE');
    });

    it('returns 422 CAPABILITY_NOT_SUPPORTED when device lacks FAUCET_CONTROL capability', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValue({
        ...mockControllableDevice,
        capabilities: [{ capability: 'SOIL_TELEMETRY', enabled: true }],
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('CAPABILITY_NOT_SUPPORTED');
    });

    it('returns 403 DEVICE_OFFLINE when target device connection status is OFFLINE', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValue({
        ...mockControllableDevice,
        connectionStatus: DeviceConnectionStatus.OFFLINE,
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('DEVICE_OFFLINE');
    });

    it('returns 422 VALIDATION_ERROR when idempotency-key is missing', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 INVALID_PHASE when requested phase is invalid (e.g. phase 4)', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 4, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('INVALID_PHASE');
    });

    it('successfully creates a QUEUED faucet command for active Admin with phase 1 (300 mL)', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.phase).toBe(1);
      expect(json.data.targetVolumeMl).toBe(300);
      expect(json.data.status).toBe(FaucetCommandStatus.QUEUED);
      expect(json.meta.requestId).toBeDefined();

      expect(mockCreateCommand).toHaveBeenCalledWith(
        {
          deviceId: mockDeviceUuid,
          action: 'DISPENSE',
          phase: 1,
          plantCount: 1,
          idempotencyKey: 'idem-001',
        },
        mockAdminUser.id,
        UserRole.ADMIN
      );
    });

    it('successfully creates a QUEUED faucet command for Owner with phase 2 (1,000 mL)', async () => {
      mockValidateSession.mockResolvedValue({ user: mockOwnerUser });
      mockCreateCommand.mockResolvedValue({
        ...mockCommandRecord,
        action: FaucetCommandAction.DISPENSE,
        phase: 2,
        plantCount: 1,
        targetVolumeMl: 1000,
        initiatedByUserId: mockOwnerUser.id,
        initiatedByRole: UserRole.OWNER,
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-002' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 2, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.phase).toBe(2);
      expect(json.data.targetVolumeMl).toBe(1000);
      expect(mockCreateCommand).toHaveBeenCalledWith(
        {
          deviceId: mockDeviceUuid,
          action: 'DISPENSE',
          phase: 2,
          plantCount: 1,
          idempotencyKey: 'idem-002',
        },
        mockOwnerUser.id,
        UserRole.OWNER
      );
    });

    it('returns 409 ACTIVE_COMMAND_EXISTS when device already has an active command in progress', async () => {
      mockCreateCommand.mockRejectedValue(
        new FaucetCommandConflictError(
          `Device '${mockDeviceUuid}' already has an active faucet command in progress (commandId: cmd-active, status: IN_PROGRESS).`
        )
      );

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-003' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 3, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('ACTIVE_COMMAND_EXISTS');
    });

    it('returns existing command when identical idempotencyKey and request payload are re-submitted', async () => {
      mockCreateCommand.mockResolvedValue(mockCommandRecord);

      const req1 = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );
      const res1 = await POST(req1, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json1 = await res1.json();

      const req2 = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );
      const res2 = await POST(req2, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json2 = await res2.json();

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(json1.data.id).toBe(mockCommandRecord.id);
      expect(json2.data.id).toBe(mockCommandRecord.id);
    });

    it('returns 409 DUPLICATE_COMMAND_CONFLICT when idempotencyKey is reused for a different command', async () => {
      mockCreateCommand.mockRejectedValue(
        new FaucetCommandConflictError(
          `Idempotency key 'idem-001' has already been used for a different command.`
        )
      );

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 2, plantCount: 1 }),
        }
      );

      const res = await POST(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('DUPLICATE_COMMAND_CONFLICT');
    });
  });

  describe('GET /api/v1/devices/[deviceId]/faucet-commands', () => {
    it('returns 401 when unauthenticated', async () => {
      mockCookieToken = undefined;

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`
      );
      const res = await GET(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 404 when device is not found', async () => {
      mockGetDeviceByCanonicalId.mockResolvedValue(null);

      const req = new Request(`http://localhost/api/v1/devices/nonexistent-node/faucet-commands`);
      const res = await GET(req, { params: Promise.resolve({ deviceId: 'nonexistent-node' }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('returns 403 DEVICE_NOT_ASSIGNED when Admin user is not assigned to target device', async () => {
      mockFindFirstUserDeviceAccess.mockResolvedValue(null);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`
      );
      const res = await GET(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
    });

    it('returns 200 OK with paginated commands list when authorized with relative URL', async () => {
      const req = {
        url: `/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands?page=1&pageSize=10`,
        headers: new Headers(),
      } as unknown as Request;
      const res = await GET(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('returns 200 OK with paginated commands list when authorized', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands?page=1&pageSize=10`
      );
      const res = await GET(req, { params: Promise.resolve({ deviceId: mockCanonicalDeviceId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBe(1);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.pageSize).toBe(20);
      expect(mockGetCommands).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: mockDeviceUuid }),
        [mockDeviceUuid]
      );
    });
  });

  describe('GET /api/v1/devices/[deviceId]/faucet-commands/[commandId]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockCookieToken = undefined;

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands/${mockCommandRecord.commandId}`
      );
      const res = await GET_COMMAND_DETAIL(req, {
        params: Promise.resolve({
          deviceId: mockCanonicalDeviceId,
          commandId: mockCommandRecord.commandId,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 404 FAUCET_COMMAND_NOT_FOUND when command does not exist', async () => {
      mockGetCommandById.mockResolvedValue(null);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands/cmd-nonexistent`
      );
      const res = await GET_COMMAND_DETAIL(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId, commandId: 'cmd-nonexistent' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('FAUCET_COMMAND_NOT_FOUND');
    });

    it('returns 200 OK with single command detail and events when authorized', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands/${mockCommandRecord.commandId}`
      );
      const res = await GET_COMMAND_DETAIL(req, {
        params: Promise.resolve({
          deviceId: mockCanonicalDeviceId,
          commandId: mockCommandRecord.commandId,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.commandId).toBe(mockCommandRecord.commandId);
      expect(json.data.targetVolumeMl).toBe(300);
      expect(json.data.events.length).toBe(1);
    });
  });
});
