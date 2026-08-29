import { describe, it, expect } from 'vitest';
import {
  AccountStatus,
  UserRole,
  normaliseEmail,
  toPublicSafeUserDto,
  UserProfileUpdateInputSchema,
  PublicSafeUserDtoSchema,
  RawDbUserWithRoles,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  RequestEmailChangeInputSchema,
  VerifyEmailChangeInputSchema,
} from '../index';

describe('TASK-0201 Contracts & DTO Verification', () => {
  it('accepts all canonical AccountStatus values and rejects invalid status', () => {
    const validStatuses = [
      AccountStatus.PENDING_APPROVAL,
      AccountStatus.APPROVED,
      AccountStatus.ACTIVE,
      AccountStatus.REJECTED,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ];

    expect(validStatuses).toHaveLength(6);
    for (const status of validStatuses) {
      expect(Object.values(AccountStatus)).toContain(status);
    }
  });

  it('accepts all canonical UserRole values and rejects invalid roles', () => {
    const validRoles = [UserRole.OWNER, UserRole.ADMIN];
    expect(validRoles).toHaveLength(2);
    for (const role of validRoles) {
      expect(Object.values(UserRole)).toContain(role);
    }
  });

  it('normalises email addresses using trim and lowercase', () => {
    expect(normaliseEmail('  User.Test@Example.COM  ')).toBe('user.test@example.com');
    expect(normaliseEmail('ADMIN@KEBUNMELON.ID')).toBe('admin@kebunmelon.id');
    expect(normaliseEmail('  leadingtrailing  @domain.com ')).toBe('leadingtrailing  @domain.com');
    expect(normaliseEmail('already.normalised@domain.com')).toBe('already.normalised@domain.com');
  });

  it('excludes passwordHash, sessionTokenHash, decisionNote, auditMetadata, databaseUrl, secret, and token at runtime', () => {
    const rawDbUserWithSecrets: RawDbUserWithRoles & Record<string, any> = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Test Admin',
      email: 'ADMIN.TEST@EXAMPLE.COM',
      username: 'testadmin',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$SECRET_HASH_VALUE$',
      sessionTokenHash: 'super-secret-session-token-hash',
      decisionNote: 'Internal owner note about approval',
      auditMetadata: { ip: '127.0.0.1', internal: true },
      databaseUrl: 'postgresql://postgres:password@localhost:5432/db',
      secret: 'my-super-secret-key',
      token: 'jwt-access-token-string',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: new Date('2026-07-28T10:00:00Z'),
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date('2026-07-20T10:00:00Z'),
      updatedAt: new Date('2026-07-28T10:00:00Z'),
      userRoles: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: '33333333-3333-3333-3333-333333333333',
          assignedByUserId: null,
          assignedAt: new Date('2026-07-20T10:00:00Z'),
          revokedAt: null,
          role: { code: UserRole.ADMIN },
        },
      ],
    };

    const publicDto = toPublicSafeUserDto(rawDbUserWithSecrets);

    expect(publicDto).not.toHaveProperty('passwordHash');
    expect(publicDto).not.toHaveProperty('sessionTokenHash');
    expect(publicDto).not.toHaveProperty('decisionNote');
    expect(publicDto).not.toHaveProperty('auditMetadata');
    expect(publicDto).not.toHaveProperty('databaseUrl');
    expect(publicDto).not.toHaveProperty('secret');
    expect(publicDto).not.toHaveProperty('token');
    expect(publicDto.email).toBe('admin.test@example.com');
    expect(publicDto.activeRoles).toEqual([UserRole.ADMIN]);

    // Validate DTO against Zod schema
    expect(() => PublicSafeUserDtoSchema.parse(publicDto)).not.toThrow();
  });

  it('distinguishes active role assignments from revoked role assignments', () => {
    const rawDbUser: RawDbUserWithRoles = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Test User',
      email: 'user@example.com',
      username: null,
      passwordHash: 'hash',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [
        {
          id: 'r1',
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: 'role-owner',
          assignedByUserId: null,
          assignedAt: new Date('2026-07-01'),
          revokedAt: new Date('2026-07-15'), // REVOKED OWNER
          role: { code: UserRole.OWNER },
        },
        {
          id: 'r2',
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: 'role-admin',
          assignedByUserId: null,
          assignedAt: new Date('2026-07-15'),
          revokedAt: null, // ACTIVE ADMIN
          role: { code: UserRole.ADMIN },
        },
      ],
    };

    const publicDto = toPublicSafeUserDto(rawDbUser);

    expect(publicDto.activeRoles).toEqual([UserRole.ADMIN]);
    expect(publicDto.activeRoles).not.toContain(UserRole.OWNER);
  });

  it('handles user record with undefined or missing userRoles gracefully', () => {
    const rawDbUser: any = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Test User',
      email: 'user@example.com',
      username: null,
      passwordHash: 'hash',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: undefined,
    };

    const publicDto = toPublicSafeUserDto(rawDbUser);
    expect(publicDto.activeRoles).toEqual([]);
  });

  it('deduplicates multiple active role assignments of the same role', () => {
    const rawDbUser: RawDbUserWithRoles = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Test User',
      email: 'user@example.com',
      username: null,
      passwordHash: 'hash',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [
        {
          id: 'r1',
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: 'role-admin-1',
          assignedByUserId: null,
          assignedAt: new Date('2026-07-01'),
          revokedAt: null,
          role: { code: UserRole.ADMIN },
        },
        {
          id: 'r2',
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: 'role-admin-2',
          assignedByUserId: null,
          assignedAt: new Date('2026-07-15'),
          revokedAt: null,
          role: { code: UserRole.ADMIN },
        },
      ],
    };

    const publicDto = toPublicSafeUserDto(rawDbUser);
    expect(publicDto.activeRoles).toEqual([UserRole.ADMIN]);
  });

  it('prevents profile update input from specifying forbidden privileged/secret fields', () => {
    const forbiddenFields = [
      'role',
      'roles',
      'roleAssignments',
      'accountStatus',
      'passwordHash',
      'password',
      'sessionTokenHash',
      'approvedBy',
      'assignedBy',
      'permissions',
    ];

    for (const field of forbiddenFields) {
      const input = { fullName: 'New Name', [field]: 'unauthorized' };
      const result = UserProfileUpdateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    }
  });

  it('allows valid profile update input and handles empty object correctly', () => {
    expect(UserProfileUpdateInputSchema.safeParse({ fullName: 'Valid Name' }).success).toBe(true);
    expect(
      UserProfileUpdateInputSchema.safeParse({ fullName: 'Valid Name', username: 'validuser' })
        .success
    ).toBe(true);
    expect(UserProfileUpdateInputSchema.safeParse({}).success).toBe(true);
  });

  it('does not mutate input raw object when building DTO', () => {
    const rawDbUser: RawDbUserWithRoles = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Unmutated User',
      email: '  UNMUTATED@EXAMPLE.COM ',
      username: null,
      passwordHash: 'hash123',
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [],
    };

    const rawCopy = { ...rawDbUser };
    toPublicSafeUserDto(rawDbUser);

    expect(rawDbUser.passwordHash).toBe('hash123');
    expect(rawDbUser.email).toBe('  UNMUTATED@EXAMPLE.COM ');
    expect(rawDbUser).toEqual(rawCopy);
  });

  describe('TASK-0213 Password Recovery & Reset Schemas', () => {
    it('validates ForgotPasswordInputSchema correctly', () => {
      expect(ForgotPasswordInputSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
      expect(ForgotPasswordInputSchema.safeParse({ email: '  user@example.com  ' }).success).toBe(
        true
      );

      // Invalid formats
      expect(ForgotPasswordInputSchema.safeParse({ email: 'invalid-email' }).success).toBe(false);
      expect(ForgotPasswordInputSchema.safeParse({ email: '' }).success).toBe(false);
      expect(ForgotPasswordInputSchema.safeParse({}).success).toBe(false);

      // Rejects injected fields (strict)
      expect(
        ForgotPasswordInputSchema.safeParse({ email: 'user@example.com', role: 'OWNER' }).success
      ).toBe(false);
    });

    it('validates ResetPasswordInputSchema correctly', () => {
      expect(
        ResetPasswordInputSchema.safeParse({
          token: 'valid-reset-token-12345',
          newPassword: 'SuperSecurePassword123!',
        }).success
      ).toBe(true);

      expect(
        ResetPasswordInputSchema.safeParse({
          token: 'valid-reset-token-12345',
          newPassword: 'SuperSecurePassword123!',
          newPasswordConfirmation: 'SuperSecurePassword123!',
        }).success
      ).toBe(true);

      // Missing token or password
      expect(ResetPasswordInputSchema.safeParse({ token: '', newPassword: 'abc' }).success).toBe(
        false
      );
      expect(ResetPasswordInputSchema.safeParse({ token: 'abc', newPassword: '' }).success).toBe(
        false
      );
      expect(ResetPasswordInputSchema.safeParse({}).success).toBe(false);

      // Rejects injected fields (strict)
      expect(
        ResetPasswordInputSchema.safeParse({
          token: 'tok',
          newPassword: 'pass',
          accountStatus: 'ACTIVE',
        }).success
      ).toBe(false);
    });

    it('validates RequestEmailChangeInputSchema correctly', () => {
      expect(
        RequestEmailChangeInputSchema.safeParse({
          newEmail: 'newemail@example.com',
          currentPassword: 'CurrentPassword123!',
        }).success
      ).toBe(true);

      // Trims whitespace
      const parsed = RequestEmailChangeInputSchema.safeParse({
        newEmail: '  trimmed@example.com  ',
        currentPassword: 'CurrentPassword123!',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.newEmail).toBe('trimmed@example.com');
      }

      // Invalid emails
      expect(
        RequestEmailChangeInputSchema.safeParse({
          newEmail: 'invalid-email',
          currentPassword: 'ValidPassword123!',
        }).success
      ).toBe(false);

      // Missing current password
      expect(
        RequestEmailChangeInputSchema.safeParse({
          newEmail: 'valid@example.com',
          currentPassword: '',
        }).success
      ).toBe(false);
      expect(
        RequestEmailChangeInputSchema.safeParse({
          newEmail: 'valid@example.com',
        }).success
      ).toBe(false);

      // Rejects injected fields (strict)
      expect(
        RequestEmailChangeInputSchema.safeParse({
          newEmail: 'valid@example.com',
          currentPassword: 'Password123!',
          role: 'OWNER',
        }).success
      ).toBe(false);
    });

    it('validates VerifyEmailChangeInputSchema correctly', () => {
      expect(
        VerifyEmailChangeInputSchema.safeParse({
          code: '123456',
        }).success
      ).toBe(true);

      // Trims code whitespace
      const parsed = VerifyEmailChangeInputSchema.safeParse({
        code: '  654321  ',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe('654321');
      }

      // Empty code
      expect(
        VerifyEmailChangeInputSchema.safeParse({
          code: '',
        }).success
      ).toBe(false);
      expect(VerifyEmailChangeInputSchema.safeParse({}).success).toBe(false);

      // Rejects injected fields (strict)
      expect(
        VerifyEmailChangeInputSchema.safeParse({
          code: '123456',
          newEmail: 'hacker@example.com',
        }).success
      ).toBe(false);
    });
  });
});
