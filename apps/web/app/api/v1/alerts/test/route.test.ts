import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../route';
import { GET as GET_DETAIL } from '../[alertId]/route';
import { AccountStatus, UserRole, AlertSeverity, AlertStatus } from '@kebun-melon/contracts';
import * as dbModule from '@kebun-melon/database';

let mockCookieToken: string | undefined = 'valid-token';

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'session_token' && mockCookieToken ? { value: mockCookieToken } : undefined,
    }),
}));

const mockGetAlerts = vi.fn();
const mockGetAlertById = vi.fn();
const mockFindManyUserDeviceAccess = vi.fn().mockResolvedValue([]);

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    prisma: {
      userDeviceAccess: {
        findMany: (...args: any[]) => mockFindManyUserDeviceAccess(...args),
      },
    },
    AlertRepository: class {
      getAlerts(...args: any[]) {
        return mockGetAlerts(...args);
      }
      getAlertById(...args: any[]) {
        return mockGetAlertById(...args);
      }
    },
  };
});

describe('Alerts API Endpoints (TASK-0701)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieToken = 'valid-token';
    mockFindManyUserDeviceAccess.mockResolvedValue([]);
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

  describe('GET /api/v1/alerts', () => {
    it('returns 401 UNAUTHENTICATED when request is unauthenticated', async () => {
      mockCookieToken = undefined;

      const res = await GET(new Request('http://localhost/api/v1/alerts'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 ACCOUNT_NOT_ACTIVE when user account is PENDING_APPROVAL', async () => {
      mockAdminSession(AccountStatus.PENDING_APPROVAL);

      const res = await GET(new Request('http://localhost/api/v1/alerts'));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('returns 422 VALIDATION_ERROR when query parameter validation fails', async () => {
      mockOwnerSession();

      const res = await GET(new Request('http://localhost/api/v1/alerts?severity=SUPER_CRITICAL'));
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns global alerts for OWNER session with HTTP 200 OK', async () => {
      mockOwnerSession();
      mockGetAlerts.mockResolvedValueOnce({
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            deviceId: '22222222-2222-2222-2222-222222222222',
            userId: null,
            alertType: 'DEVICE_OFFLINE',
            severity: AlertSeverity.CRITICAL,
            status: AlertStatus.OPEN,
            sourceType: 'device',
            sourceId: null,
            titleKey: 'alerts.deviceOffline.title',
            messageKey: 'alerts.deviceOffline.message',
            messageParams: { deviceName: 'Water Node 1' },
            openedAt: '2026-07-27T14:00:00.000Z',
            resolvedAt: null,
            createdAt: '2026-07-27T14:00:00.000Z',
            updatedAt: '2026-07-27T14:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await GET(new Request('http://localhost/api/v1/alerts'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].alertType).toBe('DEVICE_OFFLINE');
      expect(mockGetAlerts).toHaveBeenCalledWith(expect.anything(), undefined, 'owner-id-1');
    });

    it('filters device alerts to active assigned devices for ADMIN session', async () => {
      mockAdminSession();
      mockFindManyUserDeviceAccess.mockResolvedValueOnce([
        { deviceId: '22222222-2222-2222-2222-222222222222' },
      ]);

      mockGetAlerts.mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      });

      const res = await GET(new Request('http://localhost/api/v1/alerts'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetAlerts).toHaveBeenCalledWith(
        expect.anything(),
        ['22222222-2222-2222-2222-222222222222'],
        'admin-id-1'
      );
    });
  });

  describe('GET /api/v1/alerts/[alertId]', () => {
    it('returns 404 ALERT_NOT_FOUND when alert is missing or out of scope', async () => {
      mockOwnerSession();
      mockGetAlertById.mockResolvedValueOnce(null);

      const res = await GET_DETAIL(new Request('http://localhost/api/v1/alerts/non-existent'), {
        params: Promise.resolve({ alertId: 'non-existent' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ALERT_NOT_FOUND');
    });

    it('returns alert detail for OWNER session with HTTP 200 OK', async () => {
      mockOwnerSession();
      const mockAlert = {
        id: '11111111-1111-1111-1111-111111111111',
        deviceId: '22222222-2222-2222-2222-222222222222',
        alertType: 'DEVICE_OFFLINE',
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.OPEN,
      };
      mockGetAlertById.mockResolvedValueOnce(mockAlert);

      const res = await GET_DETAIL(
        new Request('http://localhost/api/v1/alerts/11111111-1111-1111-1111-111111111111'),
        { params: Promise.resolve({ alertId: '11111111-1111-1111-1111-111111111111' }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('11111111-1111-1111-1111-111111111111');
    });
  });
});
