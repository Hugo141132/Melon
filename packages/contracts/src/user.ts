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
 * Public input schema for Admin Registration.
 * Uses z.object().strict() to immediately fail or reject role, accountStatus, permissions,
 * or any other privilege injection attempt.
 */
export const AdminRegistrationInputSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required.').max(150),
    email: z.string().trim().email('Invalid email address format.'),
    password: z.string().min(1, 'Password is required.'),
  })
  .strict();

export type AdminRegistrationInput = z.infer<typeof AdminRegistrationInputSchema>;

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
