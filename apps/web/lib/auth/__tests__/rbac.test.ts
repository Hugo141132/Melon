import { describe, it, expect, vi } from 'vitest';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';
import {
  AuthorizationError,
  AuthenticatedUserSession,
  requireActiveAccount,
  requireRole,
  requirePermission,
  requireSelfOrPermission,
  requireDeviceViewAccess,
  requireDeviceControlAccess,
} from '../rbac';

describe('TASK-0209 — Authorisation Library (apps/web/lib/auth/rbac.ts)', () => {
  const activeOwner: AuthenticatedUserSession = {
    id: 'user-owner-1',
    fullName: 'Owner User',
    email: 'owner@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  const activeAdmin: AuthenticatedUserSession = {
    id: 'user-admin-1',
    fullName: 'Admin User',
    email: 'admin@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
    assignedDeviceIds: ['device-101'],
  };

  const pendingAdmin: AuthenticatedUserSession = {
    id: 'user-pending-1',
    fullName: 'Pending User',
    email: 'pending@kebunmelon.id',
    accountStatus: AccountStatus.PENDING_APPROVAL,
    activeRoles: [UserRole.ADMIN],
  };

  const suspendedAdmin: AuthenticatedUserSession = {
    id: 'user-suspended-1',
    fullName: 'Suspended User',
    email: 'suspended@kebunmelon.id',
    accountStatus: AccountStatus.SUSPENDED,
    activeRoles: [UserRole.ADMIN],
  };

  describe('requireActiveAccount', () => {
    it('1. Passes for ACTIVE account status', () => {
      expect(() => requireActiveAccount(activeOwner)).not.toThrow();
      expect(() => requireActiveAccount(activeAdmin)).not.toThrow();
    });

    it('2. Throws 403 ACCOUNT_NOT_ACTIVE for all non-ACTIVE statuses (deny by default)', () => {
      const nonActiveStatuses = [
        AccountStatus.PENDING_APPROVAL,
        AccountStatus.APPROVED,
        AccountStatus.REJECTED,
        AccountStatus.SUSPENDED,
        AccountStatus.DEACTIVATED,
      ];

      for (const status of nonActiveStatuses) {
        const userSession: AuthenticatedUserSession = {
          id: 'user-test-status',
          fullName: 'Status User',
          email: 'status@kebunmelon.id',
          accountStatus: status,
          activeRoles: [UserRole.ADMIN],
        };

        expect(() => requireActiveAccount(userSession)).toThrow(AuthorizationError);

        try {
          requireActiveAccount(userSession);
        } catch (err: any) {
          expect(err.statusCode).toBe(403);
          expect(err.code).toBe('ACCOUNT_NOT_ACTIVE');
        }
      }
    });
  });

  describe('requireRole', () => {
    it('3. Allows valid role for ACTIVE account', () => {
      expect(() => requireRole(activeOwner, UserRole.OWNER)).not.toThrow();
      expect(() => requireRole(activeAdmin, UserRole.ADMIN)).not.toThrow();
    });

    it('4. Denies role mismatch (Admin requesting Owner role)', () => {
      try {
        requireRole(activeAdmin, UserRole.OWNER);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('5. Rejects non-ACTIVE account even if role matches', () => {
      expect(() => requireRole(pendingAdmin, UserRole.ADMIN)).toThrow(AuthorizationError);
      expect(() => requireRole(suspendedAdmin, UserRole.ADMIN)).toThrow(AuthorizationError);
    });
  });

  describe('requirePermission', () => {
    it('6. Allows Owner canonical permissions (e.g. account.approve)', () => {
      expect(() => requirePermission(activeOwner, 'account.approve')).not.toThrow();
      expect(() => requirePermission(activeOwner, 'account.suspend')).not.toThrow();
    });

    it('7. Denies Owner-only permission to Admin (e.g. account.approve)', () => {
      try {
        requirePermission(activeAdmin, 'account.approve');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('INSUFFICIENT_PERMISSION');
      }
    });

    it('8. Allows Admin canonical permissions (e.g. account.register, profile.self.read)', () => {
      expect(() => requirePermission(activeAdmin, 'account.register')).not.toThrow();
      expect(() => requirePermission(activeAdmin, 'profile.self.read')).not.toThrow();
    });

    it('9. Throws for unknown or unseeded permission code', () => {
      try {
        requirePermission(activeOwner, 'invalid.permission.code');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('UNKNOWN_PERMISSION');
      }
    });
  });

  describe('requireSelfOrPermission', () => {
    it('10. Allows action if target matches self, even without admin/owner permission', () => {
      expect(() =>
        requireSelfOrPermission(activeAdmin, 'user-admin-1', 'account.approve')
      ).not.toThrow();
    });

    it('11. Allows action if target is another user but caller has permission (Owner)', () => {
      expect(() =>
        requireSelfOrPermission(activeOwner, 'user-admin-1', 'account.approve')
      ).not.toThrow();
    });

    it('12. Denies action if target is another user and caller lacks permission (Admin)', () => {
      try {
        requireSelfOrPermission(activeAdmin, 'user-other-99', 'account.approve');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('INSUFFICIENT_PERMISSION');
      }
    });
  });

  describe('requireDeviceViewAccess & requireDeviceControlAccess', () => {
    it('13. Owner has view access to any target device', async () => {
      await expect(
        requireDeviceViewAccess(activeOwner, 'unassigned-device-99')
      ).resolves.not.toThrow();
    });

    it('14. Admin has view access to assigned device', async () => {
      await expect(requireDeviceViewAccess(activeAdmin, 'device-101')).resolves.not.toThrow();
    });

    it('15. Admin denied view access to unassigned device', async () => {
      await expect(requireDeviceViewAccess(activeAdmin, 'unassigned-device-99')).rejects.toThrow(
        AuthorizationError
      );
    });

    it('16. Device control denied when ENABLE_FAUCET_CONTROL is disabled', async () => {
      delete process.env.ENABLE_FAUCET_CONTROL;
      const options = {
        isDeviceActiveAndControllable: vi.fn().mockResolvedValue(true),
      };
      await expect(requireDeviceControlAccess(activeAdmin, 'device-101', options)).rejects.toThrow(
        AuthorizationError
      );
    });

    it('17. Admin allowed device control when ENABLE_FAUCET_CONTROL=true, assigned, and device is active/controllable', async () => {
      process.env.ENABLE_FAUCET_CONTROL = 'true';
      const options = {
        isDeviceActiveAndControllable: vi.fn().mockResolvedValue(true),
      };
      await expect(
        requireDeviceControlAccess(activeAdmin, 'device-101', options)
      ).resolves.not.toThrow();
      expect(options.isDeviceActiveAndControllable).toHaveBeenCalledWith('device-101');
      delete process.env.ENABLE_FAUCET_CONTROL;
    });

    it('18. Device control denied when device is inactive/uncontrollable even if flag is true', async () => {
      process.env.ENABLE_FAUCET_CONTROL = 'true';
      const options = {
        isDeviceActiveAndControllable: vi.fn().mockResolvedValue(false),
      };
      await expect(requireDeviceControlAccess(activeAdmin, 'device-101', options)).rejects.toThrow(
        AuthorizationError
      );
      delete process.env.ENABLE_FAUCET_CONTROL;
    });
  });
});
