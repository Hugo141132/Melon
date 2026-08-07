import { describe, it, expect, vi } from 'vitest';
import {
  requireSession,
  requireActiveAccount,
  requireDeviceViewAccess,
  computeDevicePermissions,
  AuthorizationError,
} from '../../lib/auth/rbac';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

vi.mock('@kebun-melon/database', async () => {
  const actual = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    validateSession: vi.fn(),
  };
});

import { validateSession } from '@kebun-melon/database';

describe('TASK-0908 Web Session Revocation & Immediate Device Access Revocation Test Suite', () => {
  it('requireActiveAccount throws 403 ACCOUNT_NOT_ACTIVE for non-ACTIVE user statuses', () => {
    const statuses = [
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
      AccountStatus.REJECTED,
      AccountStatus.PENDING_APPROVAL,
    ];

    for (const status of statuses) {
      expect(() =>
        requireActiveAccount({
          id: 'u1',
          fullName: 'Test User',
          email: 'user@example.com',
          accountStatus: status as AccountStatus,
          activeRoles: [UserRole.ADMIN],
        })
      ).toThrowError(AuthorizationError);

      try {
        requireActiveAccount({
          id: 'u1',
          fullName: 'Test User',
          email: 'user@example.com',
          accountStatus: status as AccountStatus,
          activeRoles: [UserRole.ADMIN],
        });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('ACCOUNT_NOT_ACTIVE');
      }
    }
  });

  it('requireSession throws 401 INVALID_SESSION when validateSession returns null due to revocation', async () => {
    vi.mocked(validateSession).mockResolvedValueOnce(null);

    const mockRequest = new Request('http://localhost:3000/api/v1/devices', {
      headers: { cookie: 'session_token=revoked-token-123' },
    });

    await expect(requireSession(mockRequest)).rejects.toThrowError(AuthorizationError);

    try {
      await requireSession(mockRequest);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('INVALID_SESSION');
    }
  });

  it('requireDeviceViewAccess immediately denies access when device access is revoked in database', async () => {
    const adminSession = {
      id: 'admin-1',
      fullName: 'Admin User',
      email: 'admin@example.com',
      accountStatus: AccountStatus.ACTIVE,
      activeRoles: [UserRole.ADMIN],
    };

    const isDeviceAssignedToUserMock = vi.fn().mockResolvedValue(false); // Revoked assignment

    await expect(
      requireDeviceViewAccess(adminSession, 'device-revoked-001', {
        isDeviceAssignedToUser: isDeviceAssignedToUserMock,
      })
    ).rejects.toThrowError(AuthorizationError);

    expect(isDeviceAssignedToUserMock).toHaveBeenCalledWith('admin-1', 'device-revoked-001');

    try {
      await requireDeviceViewAccess(adminSession, 'device-revoked-001', {
        isDeviceAssignedToUser: isDeviceAssignedToUserMock,
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('DEVICE_NOT_ASSIGNED');
    }
  });

  it('computeDevicePermissions revokes view and control permissions immediately when user account is non-ACTIVE or device is unassigned', () => {
    const activeAdminSession = {
      id: 'admin-1',
      fullName: 'Admin User',
      email: 'admin@example.com',
      accountStatus: AccountStatus.ACTIVE,
      activeRoles: [UserRole.ADMIN],
    };

    const suspendedAdminSession = {
      id: 'admin-1',
      fullName: 'Admin User',
      email: 'admin@example.com',
      accountStatus: AccountStatus.SUSPENDED,
      activeRoles: [UserRole.ADMIN],
    };

    const device = {
      accountStatus: 'ACTIVE',
      capabilities: ['FAUCET_CONTROL'],
    };

    // Active Admin with revoked/unassigned device access -> canView: false, canControl: false
    const permissionsRevoked = computeDevicePermissions(activeAdminSession, device, false);
    expect(permissionsRevoked).toEqual({ canView: false, canControl: false });

    // Suspended Admin even if assigned -> canView: false, canControl: false
    const permissionsSuspended = computeDevicePermissions(suspendedAdminSession, device, true);
    expect(permissionsSuspended).toEqual({ canView: false, canControl: false });
  });
});
