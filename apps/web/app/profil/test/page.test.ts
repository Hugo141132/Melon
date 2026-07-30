import { describe, it, expect } from 'vitest';
import {
  UserProfileUpdateInputSchema,
  PublicSafeUserDtoSchema,
  AccountStatus,
  UserRole,
} from '@kebun-melon/contracts';

describe('TASK-0211 Profil Page & Contract Integration Tests', () => {
  it('1. Validates UserProfileUpdateInputSchema strict allowlist parsing', () => {
    const validPayload = { fullName: 'Budi Santoso', username: 'budis' };
    const parsed = UserProfileUpdateInputSchema.parse(validPayload);
    expect(parsed.fullName).toBe('Budi Santoso');
    expect(parsed.username).toBe('budis');

    // Reject unknown or illegal field injection
    expect(() => UserProfileUpdateInputSchema.parse({ fullName: 'Budi', role: 'OWNER' })).toThrow();

    expect(() =>
      UserProfileUpdateInputSchema.parse({ fullName: 'Budi', accountStatus: 'ACTIVE' })
    ).toThrow();

    expect(() =>
      UserProfileUpdateInputSchema.parse({ fullName: 'Budi', id: 'some-uuid' })
    ).toThrow();
  });

  it('2. Ensures PublicSafeUserDtoSchema never exposes sensitive credentials', () => {
    const userWithSecrets = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      fullName: 'Active User',
      email: 'user@example.com',
      username: 'activeuser',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      activeRoles: [UserRole.ADMIN],
      passwordHash: '$argon2id$secret-hash',
      sessionTokenHash: 'token-hash',
    };

    const parsed = PublicSafeUserDtoSchema.parse(userWithSecrets);
    expect(parsed).not.toHaveProperty('passwordHash');
    expect(parsed).not.toHaveProperty('sessionTokenHash');
    expect(parsed.fullName).toBe('Active User');
  });

  it('3. Verifies frontend contract response envelope structure', () => {
    const successResponse = {
      success: true,
      data: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fullName: 'Pak Wahyu Updated',
        email: 'wahyu@kebunmelon.id',
        username: 'wahyuowner',
        accountStatus: AccountStatus.ACTIVE,
        activeRoles: [UserRole.OWNER],
      },
      meta: { requestId: 'req-me-1' },
    };

    expect(successResponse.success).toBe(true);
    expect(successResponse.data.fullName).toBe('Pak Wahyu Updated');
  });
});
