import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as rbacModule from '../../../../../../../lib/auth/rbac';
import { AlertRepository, AlertNotFoundError } from '@kebun-melon/database';
import { UserRole, AlertStatus } from '@kebun-melon/contracts';

vi.mock('../../../../../../../lib/auth/rbac', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireSession: vi.fn(),
    requirePermission: vi.fn(),
  };
});

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    AlertRepository: vi.fn().mockImplementation(() => ({
      acknowledgeAlert: vi.fn(),
    })),
    AlertNotFoundError: actual.AlertNotFoundError,
  };
});

describe('POST /api/v1/alerts/[alertId]/acknowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 UNAUTHORIZED if session is unauthenticated', async () => {
    vi.mocked(rbacModule.requireSession).mockRejectedValue(
      new rbacModule.AuthorizationError(401, 'UNAUTHENTICATED', 'Session required')
    );

    const req = new NextRequest('http://localhost/api/v1/alerts/alert-001/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ note: 'Field check' }),
    });

    const res = await POST(req, { params: { alertId: 'alert-001' } });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN if missing alert.acknowledge permission', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'user-001',
      fullName: 'User One',
      email: 'user1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.ADMIN],
    });

    vi.mocked(rbacModule.requirePermission).mockImplementation(() => {
      throw new rbacModule.AuthorizationError(
        403,
        'INSUFFICIENT_PERMISSION',
        "Missing permission 'alert.acknowledge'"
      );
    });

    const req = new NextRequest('http://localhost/api/v1/alerts/alert-001/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ note: 'Field check' }),
    });

    const res = await POST(req, { params: { alertId: 'alert-001' } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
  });

  it('returns 404 ALERT_NOT_FOUND if alert does not exist or access denied', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'owner-001',
      fullName: 'Owner One',
      email: 'owner1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.OWNER],
    });
    vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

    const mockAck = vi
      .fn()
      .mockRejectedValue(new AlertNotFoundError("Alert 'alert-999' not found."));
    vi.mocked(AlertRepository).mockImplementation(
      () =>
        ({
          acknowledgeAlert: mockAck,
        }) as any
    );

    const req = new NextRequest('http://localhost/api/v1/alerts/alert-999/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ note: 'Field check' }),
    });

    const res = await POST(req, { params: { alertId: 'alert-999' } });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('ALERT_NOT_FOUND');
  });

  it('returns 200 with acknowledgment details on successful acknowledge', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'owner-001',
      fullName: 'Owner One',
      email: 'owner1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.OWNER],
    });
    vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

    const ackResult = {
      alertId: 'alert-001',
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date('2026-08-05T12:00:00Z'),
    };

    const mockAck = vi.fn().mockResolvedValue(ackResult);
    vi.mocked(AlertRepository).mockImplementation(
      () =>
        ({
          acknowledgeAlert: mockAck,
        }) as any
    );

    const req = new NextRequest('http://localhost/api/v1/alerts/alert-001/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ note: 'Field check completed' }),
    });

    const res = await POST(req, { params: { alertId: 'alert-001' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.alertId).toBe('alert-001');
    expect(json.data.status).toBe(AlertStatus.ACKNOWLEDGED);
  });
});
