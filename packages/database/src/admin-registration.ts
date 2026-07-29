import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import {
  AdminRegistrationInputSchema,
  AdminRegistrationInput,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  AccountStatus as ContractAccountStatus,
} from '@kebun-melon/contracts';
import { validatePasswordPolicy, hashPassword } from './password-service';

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

/**
 * Executes public Admin registration.
 *
 * Requirements & Security Invariants:
 * 1. Strict schema parse ensures privilege fields (role, accountStatus, permissions, approvedBy, etc.) cannot be injected.
 * 2. Normalises email address (trim + lowercase).
 * 3. Validates password against approved security policy.
 * 4. Checks email uniqueness; throws DuplicateEmailError on collision.
 * 5. Guarantees role = ADMIN and accountStatus = PENDING_APPROVAL on server-side.
 * 6. Never creates OWNER accounts.
 * 7. Hashes password using Argon2id reusable password service.
 * 8. Records system audit log entry for ACCOUNT_REGISTER_ADMIN.
 * 9. Returns a PublicSafeUserDto omitting any password hashes, session tokens, or secrets.
 */
export async function registerAdminUser(
  prisma: PrismaClient,
  rawInput: unknown
): Promise<RegisterAdminResult> {
  // 1. Strict input validation - rejects any extraneous fields including role/status injection
  const input: AdminRegistrationInput = AdminRegistrationInputSchema.parse(rawInput);

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

  // 3. Pre-hash password before transaction
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

    // 8. Log system audit log record (ACCOUNT_REGISTER_ADMIN)
    await tx.auditLog.create({
      data: {
        eventKey: 'ACCOUNT_REGISTER_ADMIN',
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
