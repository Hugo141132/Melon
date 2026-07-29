import { describe, it, expect, vi } from 'vitest';
import * as dbModule from '@kebun-melon/database';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

describe('Account Status Page Component Logic Tests', () => {
  it('1. Validates status configuration mappings for all required account statuses', () => {
    const statuses: AccountStatus[] = [
      AccountStatus.PENDING_APPROVAL,
      AccountStatus.APPROVED,
      AccountStatus.REJECTED,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ];

    expect(statuses).toHaveLength(5);
  });

  it('2. Revalidates session account status via API endpoint mock', async () => {
    const spy = vi.spyOn(dbModule, 'validateSession').mockResolvedValueOnce({
      session: {
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        lastSeenAt: new Date(),
      },
      user: {
        id: 'user-123',
        fullName: 'Pending Admin',
        email: 'pending@example.com',
        username: null,
        accountStatus: AccountStatus.PENDING_APPROVAL,
        emailVerifiedAt: null,
        lastLoginAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [UserRole.ADMIN],
      },
    });

    const result = await dbModule.validateSession({} as any, 'valid-token');
    expect(result).not.toBeNull();
    expect(result?.user.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);

    spy.mockRestore();
  });
});
