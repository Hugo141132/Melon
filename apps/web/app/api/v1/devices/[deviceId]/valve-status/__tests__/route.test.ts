import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../route';
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
const mockGetLatestValveStatus = vi.fn();
const mockGetValveStatusHistory = vi.fn();
const mockFindFirstUserDeviceAccess = vi.fn();

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
      getLatestValveStatus(...args: any[]) {
        return mockGetLatestValveStatus(...args);
      }
      getValveStatusHistory(...args: any[]) {
        return mockGetValveStatusHistory(...args);
      }
    },
  };
});

describe('GET /api/v1/devices/[deviceId]/valve-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';

    mockValidateSession.mockResolvedValue({
      id: 'session-1',
      user: {
        id: 'test-user-uuid',
        fullName: 'Test Owner',
        email: 'owner@example.com',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
    });

    mockGetDeviceByCanonicalId.mockResolvedValue({
      id: 'db-dev-uuid-1',
      deviceId: 'water-tank-uqiwue',
    });

    mockFindFirstUserDeviceAccess.mockResolvedValue({
      id: 'access-1',
    });
  });

  it('returns 401 when no session is present', async () => {
    mockCookieToken = undefined;
    mockValidateSession.mockResolvedValue({ valid: false });

    const req = new Request('http://localhost:3000/api/v1/devices/water-tank-uqiwue/valve-status');
    const res = await GET(req, { params: Promise.resolve({ deviceId: 'water-tank-uqiwue' }) });

    expect(res.status).toBe(401);
  });

  it('returns 404 when target device does not exist', async () => {
    mockGetDeviceByCanonicalId.mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/v1/devices/non-existent/valve-status');
    const res = await GET(req, { params: Promise.resolve({ deviceId: 'non-existent' }) });

    expect(res.status).toBe(404);
  });

  it('returns 200 with physicalState and history when status exists', async () => {
    mockGetLatestValveStatus.mockResolvedValue({
      status: 'CLOSED',
      recordedAt: new Date('2026-09-30T10:00:00Z'),
      receivedAt: new Date('2026-09-30T10:00:00Z'),
      reasonCode: 'VALVE_FEEDBACK',
    });

    mockGetValveStatusHistory.mockResolvedValue([
      {
        id: 'ev-1',
        status: 'CLOSED',
        reasonCode: 'VALVE_FEEDBACK',
        recordedAt: new Date('2026-09-30T10:00:00Z'),
        receivedAt: new Date('2026-09-30T10:00:00Z'),
      },
    ]);

    const req = new Request('http://localhost:3000/api/v1/devices/water-tank-uqiwue/valve-status');
    const res = await GET(req, { params: Promise.resolve({ deviceId: 'water-tank-uqiwue' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.physicalState).toBe('CLOSED');
    expect(json.data.history).toHaveLength(1);
  });

  it('returns UNKNOWN physicalState when no status records exist', async () => {
    mockGetLatestValveStatus.mockResolvedValue(null);
    mockGetValveStatusHistory.mockResolvedValue([]);

    const req = new Request('http://localhost:3000/api/v1/devices/water-tank-uqiwue/valve-status');
    const res = await GET(req, { params: Promise.resolve({ deviceId: 'water-tank-uqiwue' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.physicalState).toBe('UNKNOWN');
  });
});
