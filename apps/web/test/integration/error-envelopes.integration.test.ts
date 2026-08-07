import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as postFaucetCommandHandler } from '../../app/api/v1/devices/[deviceId]/faucet-commands/route';
import { GET as getLatestMonitoringHandler } from '../../app/api/v1/devices/[deviceId]/monitoring/latest/route';
import { POST as loginHandler } from '../../app/api/v1/auth/login/route';
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
const mockLoginUser = vi.fn();

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
    loginUser: (...args: any[]) => mockLoginUser(...args),
  };
});

describe('API Integration Test Suite — Error Envelopes & Secrecy Standards (TASK-1002)', () => {
  const mockAdminUser = {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Active Admin',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  const mockDeviceId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_FAUCET_CONTROL = 'true';
    mockCookieToken = 'valid-token';
  });

  describe('1. Standard Error Envelope Structure', () => {
    it('returns standard error envelope on 401 UNAUTHENTICATED', async () => {
      mockCookieToken = undefined;

      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockDeviceId}/monitoring/latest`
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: mockDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('UNAUTHENTICATED');
      expect(typeof json.error.message).toBe('string');
      expect(json.meta).toBeDefined();
      expect(json.meta.requestId).toMatch(/^req-/);
    });

    it('returns standard error envelope on 403 DEVICE_NOT_ASSIGNED', async () => {
      mockCookieToken = 'valid-token';
      mockValidateSession.mockResolvedValueOnce({ user: mockAdminUser });
      mockGetDeviceByCanonicalId.mockResolvedValueOnce({
        id: mockDeviceId,
        deviceId: 'DEV-001',
        deviceType: 'SOIL_NODE',
        isControllable: true,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['FAUCET_CONTROL'],
      });
      mockUserDeviceAccessFindFirst.mockResolvedValueOnce(null);

      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockDeviceId}/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: mockDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_ASSIGNED');
      expect(typeof json.error.message).toBe('string');
      expect(json.meta.requestId).toBeDefined();
    });

    it('returns standard error envelope on 404 DEVICE_NOT_FOUND', async () => {
      mockCookieToken = 'valid-token';
      mockValidateSession.mockResolvedValueOnce({ user: mockAdminUser });
      mockGetDeviceByCanonicalId.mockResolvedValueOnce(null);

      const req = new Request(
        `http://localhost:3000/api/v1/devices/non-existent-device/monitoring/latest`,
        { headers: { Cookie: 'session_token=valid-token' } }
      );
      const res = await getLatestMonitoringHandler(req, {
        params: Promise.resolve({ deviceId: 'non-existent-device' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DEVICE_NOT_FOUND');
      expect(typeof json.error.message).toBe('string');
      expect(json.meta.requestId).toBeDefined();
    });

    it('returns standard error envelope on 422 VALIDATION_ERROR', async () => {
      mockCookieToken = 'valid-token';
      mockValidateSession.mockResolvedValueOnce({ user: mockAdminUser });
      mockGetDeviceByCanonicalId.mockResolvedValueOnce({
        id: mockDeviceId,
        deviceId: 'DEV-001',
        deviceType: 'SOIL_NODE',
        isControllable: true,
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        capabilities: ['FAUCET_CONTROL'],
      });
      mockUserDeviceAccessFindFirst.mockResolvedValueOnce({
        id: 'assign-001',
        userId: mockAdminUser.id,
        deviceId: mockDeviceId,
      });

      const req = new Request(
        `http://localhost:3000/api/v1/devices/${mockDeviceId}/faucet-commands`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'session_token=valid-token',
          },
          body: JSON.stringify({ phase: 'INVALID_PHASE' }),
        }
      );

      const res = await postFaucetCommandHandler(req, {
        params: Promise.resolve({ deviceId: mockDeviceId }),
      });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toBeDefined();
      expect(json.meta.requestId).toBeDefined();
    });
  });

  describe('2. Secrecy Standards & Sensitive Data Protection', () => {
    it('ensures no password hashes, raw tokens, or secrets are exposed in login failure error response', async () => {
      mockLoginUser.mockRejectedValueOnce(new dbModule.InvalidCredentialsError());

      const req = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@kebunmelon.id',
          password: 'WrongPassword!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();
      const stringified = JSON.stringify(json);

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(stringified).not.toContain('passwordHash');
      expect(stringified).not.toContain('tokenHash');
      expect(stringified).not.toContain('secret');
    });
  });
});
