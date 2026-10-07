import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as rbacModule from '../../../../../../lib/auth/rbac';
import { AlertRepository } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';

vi.mock('../../../../../../lib/auth/rbac', async (importOriginal) => {
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
    AlertRepository: vi.fn().mockImplementation(function () {
      return {
        acknowledgeAlertsBulk: vi.fn(),
      };
    }),
  };
});

describe('POST /api/v1/alerts/bulk-acknowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 UNAUTHENTICATED if session is missing', async () => {
    vi.mocked(rbacModule.requireSession).mockRejectedValue(
      new rbacModule.AuthorizationError(401, 'UNAUTHENTICATED', 'Session required')
    );

    const req = new NextRequest('http://localhost/api/v1/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ alertIds: ['00000000-0000-0000-0000-000000000001'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN if user lacks alert.acknowledge permission', async () => {
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

    const req = new NextRequest('http://localhost/api/v1/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ alertIds: ['00000000-0000-0000-0000-000000000001'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
  });

  it('returns 422 VALIDATION_ERROR on empty payload', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'owner-001',
      fullName: 'Owner One',
      email: 'owner1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.OWNER],
    });
    vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

    const req = new NextRequest('http://localhost/api/v1/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with result on successful bulk acknowledge of selected IDs', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'owner-001',
      fullName: 'Owner One',
      email: 'owner1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.OWNER],
    });
    vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

    const targetIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ];
    const mockBulkAck = vi.fn().mockResolvedValue({
      acknowledgedCount: 2,
      alertIds: targetIds,
    });
    vi.mocked(AlertRepository).mockImplementation(function () {
      return {
        acknowledgeAlertsBulk: mockBulkAck,
      } as any;
    });

    const req = new NextRequest('http://localhost/api/v1/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ alertIds: targetIds }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.acknowledgedCount).toBe(2);
    expect(json.data.alertIds).toEqual(targetIds);
  });

  it('returns 422 VALIDATION_ERROR when { all: true } is sent without alertIds', async () => {
    vi.mocked(rbacModule.requireSession).mockResolvedValue({
      id: 'owner-001',
      fullName: 'Owner One',
      email: 'owner1@example.com',
      accountStatus: 'ACTIVE' as any,
      activeRoles: [UserRole.OWNER],
    });
    vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

    const req = new NextRequest('http://localhost/api/v1/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
