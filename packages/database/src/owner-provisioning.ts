import { PrismaClient, AccountStatus, UserRole } from '@prisma/client';
import { validatePasswordPolicy, hashPassword, verifyPassword } from './password-service';

export { validatePasswordPolicy };

/**
 * Stable, application-specific 64-bit integer advisory lock key for first-Owner provisioning.
 * Reserved exclusively for serialising initial system bootstrap.
 */
export const FIRST_OWNER_PROVISIONING_LOCK_ID = BigInt('84736291106');

export interface OwnerProvisioningInput {
  email: string;
  password: string;
  fullName: string;
}

export interface OwnerProvisioningOptions {
  simulateFailure?: boolean;
}

export interface OwnerProvisioningResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    accountStatus: AccountStatus;
  };
  passwordHash: string;
}

/**
 * Normalises an email address according to the single canonical application rule:
 * Trim whitespace and convert to lowercase.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates email format.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates that a database URL for automated testing targets a disposable test database.
 * Requires the database name in the URL path to contain 'test' or 'disposable'.
 */
export function validateTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      'Safety check failed: TEST_DATABASE_URL or E2E_DATABASE_URL environment variable is required for test execution.'
    );
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host.includes('supabase.co') ||
      host.includes('supabase.com') ||
      host.includes('railway.app') ||
      host.includes('neon.tech')
    ) {
      throw new Error(
        `Safety check failed: Test database host '${host}' cannot target remote Supabase, Railway, or managed cloud environments.`
      );
    }
    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName.toLowerCase().includes('test') && !dbName.toLowerCase().includes('disposable')) {
      throw new Error(
        `Safety check failed: Test database name '${dbName}' must explicitly contain 'test' or 'disposable'.`
      );
    }
  } catch (err: any) {
    if (err.message.startsWith('Safety check failed')) throw err;
    throw new Error(`Invalid test database URL format: ${err.message}`);
  }
  return url;
}

/**
 * Provisions the first system OWNER account in a single atomic transaction.
 *
 * Enforces:
 * 1. Transaction-scoped PostgreSQL advisory locking for complete race safety across concurrent processes.
 * 2. Precondition check: Rejects if ANY non-revoked OWNER role assignment exists (regardless of user account status).
 * 3. Pre-existing canonical OWNER role lookup from database (instructs operator to run seed if missing).
 * 4. Input email normalisation (trim + lowercase) and password policy validation.
 * 5. Secure Argon2id password hashing.
 * 6. User creation in ACTIVE state, exactly 1 non-revoked OWNER assignment, 0 ADMIN assignments.
 * 7. System/null actor AuditLog record creation (no passwords, hashes, tokens, or DB URLs).
 * 8. Omission of AccountApproval record (initial Owner creation is a system bootstrap event, not an Admin approval event).
 */
export async function provisionFirstOwner(
  prisma: PrismaClient,
  input: OwnerProvisioningInput,
  options?: OwnerProvisioningOptions
): Promise<OwnerProvisioningResult> {
  const normalisedEmail = normaliseEmail(input.email);
  if (!validateEmail(normalisedEmail)) {
    throw new Error(`Invalid email address format: '${input.email}'`);
  }

  const nameTrimmed = input.fullName.trim();
  if (!nameTrimmed) {
    throw new Error('Owner full name is required and cannot be empty.');
  }

  const pwdCheck = validatePasswordPolicy(input.password);
  if (!pwdCheck.valid) {
    throw new Error(`Password policy violation: ${pwdCheck.reason}`);
  }

  // Pre-hash password before entering transaction to keep transaction window small
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Acquire transaction-scoped PostgreSQL advisory lock for first-Owner critical section
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FIRST_OWNER_PROVISIONING_LOCK_ID})`;

      // 2. Check for ANY non-revoked OWNER role assignment regardless of user account status
      const existingOwnerAssignment = await tx.userRoleAssignment.findFirst({
        where: {
          role: { code: UserRole.OWNER },
          revokedAt: null,
        },
        include: {
          user: true,
        },
      });

      if (existingOwnerAssignment) {
        throw new Error(
          'First Owner account already exists. System already has an assigned Owner account.'
        );
      }

      // 3. Verify canonical OWNER role exists in database
      const ownerRole = await tx.role.findUnique({
        where: { code: UserRole.OWNER },
      });

      if (!ownerRole) {
        throw new Error(
          'Canonical OWNER role is missing from the database. Please run `npm run db:seed` first.'
        );
      }

      // 4. Verify email uniqueness against normalised email
      const existingUserWithEmail = await tx.user.findUnique({
        where: { email: normalisedEmail },
      });

      if (existingUserWithEmail) {
        throw new Error(`User with email '${normalisedEmail}' already exists.`);
      }

      // 5. Test failure simulation hook for rollback validation
      if (options?.simulateFailure) {
        throw new Error('SIMULATED_PROVISIONING_FAILURE');
      }

      // 6. Create User in ACTIVE status
      const ownerUser = await tx.user.create({
        data: {
          fullName: nameTrimmed,
          email: normalisedEmail,
          passwordHash: passwordHash,
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      // 7. Assign OWNER role
      await tx.userRoleAssignment.create({
        data: {
          userId: ownerUser.id,
          roleId: ownerRole.id,
          assignedByUserId: null,
          assignedAt: new Date(),
          revokedAt: null,
        },
      });

      // 8. Log system audit record (null actor, non-sensitive metadata only)
      await tx.auditLog.create({
        data: {
          eventKey: 'ACCOUNT_PROVISION_OWNER',
          actorUserId: null,
          actorRole: null,
          targetType: 'USER',
          targetId: ownerUser.id,
          result: 'SUCCESS',
          newValues: {
            id: ownerUser.id,
            email: ownerUser.email,
            fullName: ownerUser.fullName,
            accountStatus: AccountStatus.ACTIVE,
            role: UserRole.OWNER,
          },
          metadata: {
            action: 'FIRST_OWNER_PROVISIONING',
          },
        },
      });

      return {
        user: {
          id: ownerUser.id,
          email: ownerUser.email,
          fullName: ownerUser.fullName,
          accountStatus: ownerUser.accountStatus,
        },
        passwordHash: ownerUser.passwordHash,
      };
    },
    {
      isolationLevel: 'Serializable',
    }
  );

  return result;
}

/**
 * Verifies a stored Argon2id password hash using the reusable password service.
 */
export async function verifyOwnerPassword(
  storedHash: string,
  plainPassword: string
): Promise<boolean> {
  return await verifyPassword(storedHash, plainPassword);
}
