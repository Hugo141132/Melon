import { z } from 'zod';
import { AccountStatus, UserRole } from './enums';

/**
 * Normalises an email address according to the canonical rule: trim + lowercase.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Zod schema for AccountStatus validation.
 */
export const AccountStatusSchema = z.nativeEnum(AccountStatus);

/**
 * Zod schema for UserRole validation.
 */
export const UserRoleSchema = z.nativeEnum(UserRole);

/**
 * Schema for user role assignment contract.
 * Role assignments are stored independently from User record.
 */
export const UserRoleAssignmentDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  roleCode: UserRoleSchema,
  assignedByUserId: z.string().uuid().nullable(),
  assignedAt: z.date(),
  revokedAt: z.date().nullable(),
  isActive: z.boolean(),
});

export type UserRoleAssignmentDto = z.infer<typeof UserRoleAssignmentDtoSchema>;

/**
 * Public-Safe User DTO schema.
 * EXCLUDES: passwordHash, sessionTokenHash, approval internal notes, raw audit metadata, DB credentials, secrets.
 * Strips any unrecognised or sensitive properties at runtime using strict allow-list parsing.
 */
export const PublicSafeUserDtoSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  username: z.string().nullable(),
  accountStatus: AccountStatusSchema,
  emailVerifiedAt: z.date().nullable(),
  lastLoginAt: z.date().nullable(),
  suspendedAt: z.date().nullable(),
  deactivatedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  activeRoles: z.array(UserRoleSchema),
});

export type PublicSafeUserDto = z.infer<typeof PublicSafeUserDtoSchema>;

/**
 * Raw internal user entity type with role assignments (as retrieved from DB).
 */
export interface RawDbUserWithRoles {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  passwordHash: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  suspendedAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles?: Array<{
    id: string;
    userId: string;
    roleId: string;
    assignedByUserId: string | null;
    assignedAt: Date;
    revokedAt: Date | null;
    role?: {
      code: UserRole;
    };
  }>;
}

/**
 * Converts a database user record to a public-safe DTO.
 * Uses explicit allow-list mapping and Zod schema parse to guarantee secret fields are omitted.
 * Preserves caller input object immutability.
 */
export function toPublicSafeUserDto(user: RawDbUserWithRoles): PublicSafeUserDto {
  const activeRoles: UserRole[] = [];

  if (user.userRoles) {
    for (const assignment of user.userRoles) {
      if (assignment.revokedAt === null && assignment.role?.code) {
        if (!activeRoles.includes(assignment.role.code)) {
          activeRoles.push(assignment.role.code);
        }
      }
    }
  }

  // Construct explicit allow-list object (no object spread of user)
  const dto: PublicSafeUserDto = {
    id: user.id,
    fullName: user.fullName,
    email: normaliseEmail(user.email),
    username: user.username ?? null,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    suspendedAt: user.suspendedAt ?? null,
    deactivatedAt: user.deactivatedAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    activeRoles,
  };

  // Validate output against Zod schema to guarantee contract & type agreement
  return PublicSafeUserDtoSchema.parse(dto);
}

/**
 * Schema for updating user profile data by user self or Owner.
 * EXCLUDES role, roles, roleAssignments, accountStatus, passwordHash, password, sessionTokenHash, approvedBy, assignedBy, permissions.
 * Uses z.object().strict() to reject unknown or forbidden properties.
 */
export const UserProfileUpdateInputSchema = z
  .object({
    fullName: z.string().min(1).max(150).optional(),
    username: z.string().min(1).max(100).nullable().optional(),
  })
  .strict();

export type UserProfileUpdateInput = z.infer<typeof UserProfileUpdateInputSchema>;

/**
 * Public input schema for User Registration.
 * Supports requested role ("OWNER" or "ADMIN").
 * Uses z.object().strict() to immediately fail or reject extraneous or unapproved privilege fields.
 */
export const UserRegistrationInputSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required.').max(150),
    email: z.string().trim().email('Invalid email address format.'),
    password: z.string().min(1, 'Password is required.'),
    role: z.enum([UserRole.OWNER, UserRole.ADMIN]).default(UserRole.ADMIN),
  })
  .strict();

export type UserRegistrationInput = z.infer<typeof UserRegistrationInputSchema>;

// Alias for backwards compatibility
export const AdminRegistrationInputSchema = UserRegistrationInputSchema;
export type AdminRegistrationInput = UserRegistrationInput;

/**
 * Input schema for User Login.
 * Uses z.object().strict() to reject extraneous injected fields.
 */
export const LoginInputSchema = z
  .object({
    email: z.string().trim().email('Invalid email address format.'),
    password: z.string().min(1, 'Password is required.'),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Schema for pending admin registration items exposed to Owner in approval list/detail endpoints.
 * EXCLUDES: passwordHash, sessionTokenHash, internal notes, raw audit metadata, DB credentials, secrets.
 */
export const PendingApprovalItemDtoSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  accountStatus: AccountStatusSchema,
  createdAt: z.date(),
});

export type PendingApprovalItemDto = z.infer<typeof PendingApprovalItemDtoSchema>;

/**
 * Schema for querying pending approval list.
 */
export const PendingApprovalsQueryInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.enum(['createdAt:asc', 'createdAt:desc']).default('createdAt:desc'),
});

export type PendingApprovalsQueryInput = z.infer<typeof PendingApprovalsQueryInputSchema>;

/**
 * Schema for updating profile data of another user by Owner.
 * EXCLUDES email (strictly READ-ONLY), role, accountStatus, passwordHash, sessionTokenHash, etc.
 * Uses z.object().strict() to reject unknown or forbidden properties.
 */
export const OwnerUserProfileUpdateInputSchema = z
  .object({
    fullName: z.string().min(1, 'Full name cannot be empty.').max(150).optional(),
    username: z.string().min(1).max(100).nullable().optional(),
  })
  .strict();

export type OwnerUserProfileUpdateInput = z.infer<typeof OwnerUserProfileUpdateInputSchema>;

/**
 * Schema for querying user management list by Owner.
 */
export const UserQueryInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  role: UserRoleSchema.optional(),
  accountStatus: AccountStatusSchema.optional(),
  search: z.string().optional(),
  sort: z
    .enum(['createdAt:asc', 'createdAt:desc', 'fullName:asc', 'fullName:desc'])
    .default('createdAt:desc'),
});

export type UserQueryInput = z.infer<typeof UserQueryInputSchema>;

/**
 * Schema for user lifecycle actions (suspend, deactivate, activate) with an optional reason.
 */
export const UserLifecycleActionInputSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export type UserLifecycleActionInput = z.infer<typeof UserLifecycleActionInputSchema>;

/**
 * Schema for updating user preferences.
 */
export const UserPreferenceUpdateInputSchema = z
  .object({
    preferredLocale: z.enum(['id', 'en']).optional(),
    timezone: z.string().max(100).optional(),
    defaultDeviceId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type UserPreferenceUpdateInput = z.infer<typeof UserPreferenceUpdateInputSchema>;

/**
 * Public input schema for Forgot Password requests.
 * Accepts email to request a single-use password recovery link.
 * Strict object validation rejects unapproved injected fields.
 */
export const ForgotPasswordInputSchema = z
  .object({
    email: z.string().trim().email('Invalid email address format.'),
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

/**
 * Public input schema for Reset Password requests.
 * Requires single-use raw token and new password (optional confirmation).
 * Strict object validation rejects extraneous injected fields.
 */
export const ResetPasswordInputSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.'),
    newPassword: z.string().min(1, 'New password is required.'),
    newPasswordConfirmation: z.string().min(1, 'Password confirmation is required.').optional(),
  })
  .strict();

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

/**
 * Public input schema for verifying email ownership.
 */
export const VerifyEmailInputSchema = z
  .object({
    token: z.string().min(1, 'Verification token is required.'),
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;

/**
 * Public input schema for resending email verification.
 */
export const ResendVerificationEmailInputSchema = z
  .object({
    email: z.string().trim().email('Invalid email address format.'),
  })
  .strict();

export type ResendVerificationEmailInput = z.infer<typeof ResendVerificationEmailInputSchema>;
