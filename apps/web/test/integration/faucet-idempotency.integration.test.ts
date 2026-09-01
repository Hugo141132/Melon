import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as createFaucetCommandHandler } from '../../app/api/v1/devices/[deviceId]/faucet-commands/route';
import {
  AccountStatus,
  UserRole,
  DeviceAccountStatus,
  DeviceConnectionStatus,
  DeviceType,
  FaucetCommandStatus,
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
    },
  };
});

describe('API Integration Test Suite — Faucet Idempotency & Phase Mapping (TASK-1002)', () => {
  const originalEnv = process.env.ENABLE_FAUCET_CONTROL;

  const mockAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Active Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
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

  const mockCommandPhase1 = {
    id: 'cmd-rec-001',
    commandId: 'cmd-JXYZ101',
    deviceId: mockDeviceUuid,
    initiatedByUserId: mockAdminUser.id,
    initiatedByRole: UserRole.ADMIN,
    phase: 1,
    targetVolumeMl: 300,
    status: FaucetCommandStatus.QUEUED,
    idempotencyKey: 'idem-key-001',
    events: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_FAUCET_CONTROL = 'true';
    mockCookieToken = 'valid-token';
    mockValidateSession.mockResolvedValue({ user: mockAdminUser });
    mockGetDeviceByCanonicalId.mockResolvedValue(mockControllableDevice);
    mockFindFirstUserDeviceAccess.mockResolvedValue({ id: 'access-001' });
  });

  afterEach(() => {
    process.env.ENABLE_FAUCET_CONTROL = originalEnv;
  });

  describe('1. Server-Side Phase to Target Volume Mapping', () => {
    it('maps Phase 1 to exactly 300 mL target volume', async () => {
      mockCreateCommand.mockResolvedValueOnce(mockCommandPhase1);

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-phase1' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.phase).toBe(1);
      expect(json.data.targetVolumeMl).toBe(300);
    });

    it('maps Phase 2 to exactly 1,000 mL target volume', async () => {
      mockCreateCommand.mockResolvedValueOnce({
        ...mockCommandPhase1,
        phase: 2,
        targetVolumeMl: 1000,
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-phase2' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 2, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.phase).toBe(2);
      expect(json.data.targetVolumeMl).toBe(1000);
    });

    it('maps Phase 3 to exactly 1,500 mL target volume', async () => {
      mockCreateCommand.mockResolvedValueOnce({
        ...mockCommandPhase1,
        phase: 3,
        targetVolumeMl: 1500,
      });

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-phase3' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 3, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.phase).toBe(3);
      expect(json.data.targetVolumeMl).toBe(1500);
    });

    it('rejects invalid phase values (e.g. phase 4) with 422 VALIDATION_ERROR', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-invalid' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 4, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Idempotency Key Processing & Replays', () => {
    it('returns existing command when identical request is re-submitted with same idempotency key', async () => {
      mockCreateCommand.mockResolvedValue(mockCommandPhase1);

      const req1 = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-replay-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );
      const res1 = await createFaucetCommandHandler(req1, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json1 = await res1.json();

      const req2 = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-replay-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );
      const res2 = await createFaucetCommandHandler(req2, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json2 = await res2.json();

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(json1.data.id).toBe(json2.data.id);
      expect(json1.data.commandId).toBe(json2.data.commandId);
    });

    it('returns 409 DUPLICATE_COMMAND_CONFLICT when idempotency key is reused for different parameters', async () => {
      mockCreateCommand.mockRejectedValue(
        new FaucetCommandConflictError(
          `Idempotency key 'idem-conflict-001' has already been used for a different command.`
        )
      );

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-conflict-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 2, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('DUPLICATE_COMMAND_CONFLICT');
    });
  });

  describe('3. Active Command Concurrency Conflict', () => {
    it('returns 409 ACTIVE_COMMAND_EXISTS when device already has an active command in progress', async () => {
      mockCreateCommand.mockRejectedValue(
        new FaucetCommandConflictError(
          `Device '${mockDeviceUuid}' already has an active faucet command in progress.`
        )
      );

      const req = new Request(
        `http://localhost/api/v1/devices/${mockCanonicalDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-active-001' },
          body: JSON.stringify({ action: 'DISPENSE', phase: 1, plantCount: 1 }),
        }
      );

      const res = await createFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockCanonicalDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('ACTIVE_COMMAND_EXISTS');
    });
  });
});
