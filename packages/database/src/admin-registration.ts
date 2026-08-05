import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import {
  UserRegistrationInputSchema,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  AccountStatus as ContractAccountStatus,
  UserRole as ContractUserRole,
  AuditEventKey,
} from '@kebun-melon/contracts';
import { validatePasswordPolicy, hashPassword } from './password-service';
import { provisionFirstOwner } from './owner-provisioning';

export interface RegisterAdminResult {
  user: PublicSafeUserDto;
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`User with email '${email}' already exists.`);
    this.name = 'DuplicateEmailError';
  }
}

export class MissingRoleError extends Error {
  constructor(roleCode: string) {
    super(`Canonical '${roleCode}' role is missing from the database. Please run seed script.`);
    this.name = 'MissingRoleError';
  }
}

export class PasswordPolicyError extends Error {
  constructor(reason: string) {
    super(`Password policy violation: ${reason}`);
    this.name = 'PasswordPolicyError';
  }
}

export class OwnerAlreadyExistsError extends Error {
  constructor() {
    super('First Owner account already exists. System already has an assigned Owner account.');
    this.name = 'OwnerAlreadyExistsError';
  }
}

/**
 * Checks if a non-revoked Owner account currently exists in the database.
 */
export async function isOwnerRegistrationAvailable(prisma: PrismaClient): Promise<boolean> {
  const existingOwner = await prisma.userRoleAssignment.findFirst({
    where: {
      role: { code: UserRole.OWNER },
      revokedAt: null,
    },
    select: { id: true },
  });
  return !existingOwner;
}

/**
 * Executes public User registration (supporting requested role: OWNER or ADMIN).
 *
 * Requirements & Security Invariants:
 * 1. Strict schema parse ensures privilege fields (role, accountStatus, permissions, etc.) cannot be injected.
 * 2. Normalises email address (trim + lowercase).
 * 3. Validates password against approved security policy.
 * 4. Checks email uniqueness; throws DuplicateEmailError on collision.
 * 5. Role = OWNER: If no Owner exists, creates OWNER in ACTIVE status using transaction-scoped PostgreSQL advisory lock.
 *    If an Owner already exists, throws OwnerAlreadyExistsError.
 * 6. Role = ADMIN: Creates ADMIN in PENDING_APPROVAL status requiring Owner approval.
 * 7. Records system audit log entry.
 * 8. Returns a PublicSafeUserDto omitting any password hashes, session tokens, or secrets.
 */
export async function registerUser(
  prisma: PrismaClient,
  rawInput: unknown
): Promise<RegisterAdminResult> {
  // 1. Strict input validation
  const input = UserRegistrationInputSchema.parse(rawInput);
  const normalised = normaliseEmail(input.email);
  const fullNameTrimmed = input.fullName.trim();

  if (!fullNameTrimmed) {
    throw new Error('Full name is required and cannot be whitespace only.');
  }

  // 2. Password policy validation
  const pwdCheck = validatePasswordPolicy(input.password);
  if (!pwdCheck.valid) {
    throw new PasswordPolicyError(pwdCheck.reason || 'Password policy violation.');
  }

  // Handle OWNER registration path
  if (input.role === ContractUserRole.OWNER) {
    try {
      const provisionRes = await provisionFirstOwner(prisma, {
        email: normalised,
        fullName: fullNameTrimmed,
        password: input.password,
      });

      const fullOwner = await prisma.user.findUniqueOrThrow({
        where: { id: provisionRes.user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          accountStatus: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          suspendedAt: true,
          deactivatedAt: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            where: { revokedAt: null },
            select: {
              id: true,
              userId: true,
              roleId: true,
              assignedByUserId: true,
              assignedAt: true,
              revokedAt: true,
              role: { select: { code: true } },
            },
          },
        },
      });

      const safeUser = toPublicSafeUserDto({
        ...fullOwner,
        passwordHash: '',
        accountStatus: fullOwner.accountStatus as ContractAccountStatus,
        userRoles: fullOwner.userRoles.map((ur) => ({
          ...ur,
          role: ur.role ? { code: ur.role.code as any } : undefined,
        })),
      });

      return { user: safeUser };
    } catch (err: any) {
      if (
        err.message?.includes('First Owner account already exists') ||
        err.message?.includes('already has an assigned Owner account')
      ) {
        throw new OwnerAlreadyExistsError();
      }
      if (err.message?.includes('already exists')) {
        throw new DuplicateEmailError(normalised);
      }
      throw err;
    }
  }

  // Handle ADMIN registration path
  const passwordHash = await hashPassword(input.password);

  return await prisma.$transaction(async (tx) => {
    // 4. Verify email uniqueness
    const existingUser = await tx.user.findUnique({
      where: { email: normalised },
      select: { id: true },
    });

    if (existingUser) {
      throw new DuplicateEmailError(normalised);
    }

    // 5. Lookup canonical ADMIN role
    const adminRole = await tx.role.findUnique({
      where: { code: UserRole.ADMIN },
      select: { id: true, code: true },
    });

    if (!adminRole) {
      throw new MissingRoleError(UserRole.ADMIN);
    }

    // 6. Create User strictly with PENDING_APPROVAL status
    const createdUser = await tx.user.create({
      data: {
        fullName: fullNameTrimmed,
        email: normalised,
        passwordHash,
        accountStatus: AccountStatus.PENDING_APPROVAL,
      },
    });

    // 7. Assign ADMIN role assignment
    await tx.userRoleAssignment.create({
      data: {
        userId: createdUser.id,
        roleId: adminRole.id,
        assignedByUserId: null, // System / Public registration
        assignedAt: new Date(),
        revokedAt: null,
      },
    });

    // 8. Log system audit log record (account.registration.created)
    await tx.auditLog.create({
      data: {
        eventKey: AuditEventKey.ACCOUNT_REGISTRATION_CREATED,
        actorUserId: null,
        actorRole: null,
        targetType: 'USER',
        targetId: createdUser.id,
        result: 'SUCCESS',
        newValues: {
          id: createdUser.id,
          email: createdUser.email,
          fullName: createdUser.fullName,
          accountStatus: AccountStatus.PENDING_APPROVAL,
          role: UserRole.ADMIN,
        },
        metadata: {
          action: 'PUBLIC_ADMIN_REGISTRATION',
        },
      },
    });

    // 9. Fetch user with role relations using explicit select for safe DTO conversion
    const fullUser = await tx.user.findUniqueOrThrow({
      where: { id: createdUser.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        accountStatus: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        deactivatedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          where: { revokedAt: null },
          select: {
            id: true,
            userId: true,
            roleId: true,
            assignedByUserId: true,
            assignedAt: true,
            revokedAt: true,
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    const safeUser = toPublicSafeUserDto({
      ...fullUser,
      passwordHash: '',
      accountStatus: fullUser.accountStatus as ContractAccountStatus,
      userRoles: fullUser.userRoles.map((ur) => ({
        ...ur,
        role: ur.role ? { code: ur.role.code as any } : undefined,
      })),
    });

    return { user: safeUser };
  });
}

// Export alias for backwards compatibility
export const registerAdminUser = registerUser;
