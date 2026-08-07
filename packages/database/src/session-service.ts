import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  AccountStatus,
  UserRole,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  LoginInputSchema,
  RawDbUserWithRoles,
  AuditEventKey,
} from '@kebun-melon/contracts';
import { verifyPassword } from './password-service';

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60; // 28800 seconds (8 hours)

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountStatusForbiddenError extends Error {
  constructor(public readonly status: AccountStatus) {
    super(`Account is ${status}. Access forbidden.`);
    this.name = 'AccountStatusForbiddenError';
  }
}

/**
 * Hashes a raw session token using SHA-256 (hex-encoded).
 * Raw session tokens are never stored in the database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface LoginResult {
  rawToken: string;
  user: PublicSafeUserDto;
}

/**
 * Authenticates a user with email and password, enforces account status revalidation,
 * generates a new session token (session rotation), stores only the session token hash,
 * updates lastLoginAt, creates an audit log entry (without secrets), and returns the raw token and user DTO.
 */
export async function loginUser(
  prisma: PrismaClient,
  rawInput: unknown,
  metadata?: LoginMetadata
): Promise<LoginResult> {
  const input = LoginInputSchema.parse(rawInput);
  const normalised = normaliseEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    include: {
      userRoles: {
        where: { revokedAt: null },
        include: { role: true },
      },
    },
  });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const isPasswordValid = await verifyPassword(user.passwordHash, input.password);
  if (!isPasswordValid) {
    throw new InvalidCredentialsError();
  }

  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new AccountStatusForbiddenError(user.accountStatus as AccountStatus);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = hashSessionToken(rawToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_LIFETIME_MS);

  const activeRoles: UserRole[] = user.userRoles
    .filter((ur) => ur.revokedAt === null && ur.role?.code)
    .map((ur) => ur.role.code as UserRole);

  const primaryRole = activeRoles[0] ?? UserRole.ADMIN;

  const sessionId = crypto.randomUUID();

  await prisma.$transaction([
    prisma.session.create({
      data: {
        id: sessionId,
        sessionTokenHash,
        userId: user.id,
        expiresAt,
        lastSeenAt: now,
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    }),
    prisma.auditLog.create({
      data: {
        eventKey: AuditEventKey.AUTH_LOGIN_SUCCESS,
        actorUserId: user.id,
        actorRole: primaryRole,
        targetType: 'User',
        targetId: user.id,
        result: 'SUCCESS',
        metadata: {
          sessionId,
        },
        requestId: metadata?.requestId ?? null,
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    }),
  ]);

  const rawUserWithRoles: RawDbUserWithRoles = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    passwordHash: '',
    accountStatus: user.accountStatus as AccountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: now,
    suspendedAt: user.suspendedAt,
    deactivatedAt: user.deactivatedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    userRoles: user.userRoles.map((ur) => ({
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      assignedByUserId: ur.assignedByUserId,
      assignedAt: ur.assignedAt,
      revokedAt: ur.revokedAt,
      role: ur.role ? { code: ur.role.code as UserRole } : undefined,
    })),
  };

  const safeUser = toPublicSafeUserDto(rawUserWithRoles);

  return {
    rawToken,
    user: safeUser,
  };
}

export interface ValidatedSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    lastSeenAt: Date | null;
  };
  user: PublicSafeUserDto;
}

/**
 * Validates a session by its raw token.
 * Checks 30-minute idle timeout, 12-hour absolute lifetime, and revalidates that the user's
 * account status remains ACTIVE. If invalid, soft-revokes the session and returns null.
 */
export async function validateSession(
  prisma: PrismaClient,
  rawToken: string
): Promise<ValidatedSession | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: {
      user: {
        include: {
          userRoles: {
            where: { revokedAt: null },
            include: { role: true },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt !== null) {
    return null;
  }

  // 12-hour absolute lifetime check
  if (now.getTime() >= session.expiresAt.getTime()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    return null;
  }

  // 30-minute idle timeout check
  if (session.lastSeenAt) {
    const idleDuration = now.getTime() - session.lastSeenAt.getTime();
    if (idleDuration > SESSION_IDLE_TIMEOUT_MS) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });
      return null;
    }
  }

  // Account status revalidation check
  if (session.user.accountStatus !== AccountStatus.ACTIVE) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    return null;
  }

  // Session is valid: update lastSeenAt
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: now },
  });

  const rawUserWithRoles: RawDbUserWithRoles = {
    id: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    username: session.user.username,
    passwordHash: '',
    accountStatus: session.user.accountStatus as AccountStatus,
    emailVerifiedAt: session.user.emailVerifiedAt,
    lastLoginAt: session.user.lastLoginAt,
    suspendedAt: session.user.suspendedAt,
    deactivatedAt: session.user.deactivatedAt,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
    userRoles: session.user.userRoles.map((ur) => ({
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      assignedByUserId: ur.assignedByUserId,
      assignedAt: ur.assignedAt,
      revokedAt: ur.revokedAt,
      role: ur.role ? { code: ur.role.code as UserRole } : undefined,
    })),
  };

  const safeUser = toPublicSafeUserDto(rawUserWithRoles);

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      lastSeenAt: now,
    },
    user: safeUser,
  };
}

/**
 * Revokes a session given its raw token.
 * Safe and idempotent: returns false if session is missing or already revoked without throwing errors.
 */
export async function revokeSession(
  prisma: PrismaClient,
  rawToken: string,
  metadata?: { requestId?: string }
): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }

  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
  });

  if (!session || session.revokedAt !== null) {
    return false;
  }

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        eventKey: AuditEventKey.AUTH_LOGOUT,
        actorUserId: session.userId,
        targetType: 'User',
        targetId: session.userId,
        result: 'SUCCESS',
        metadata: {
          sessionId: session.id,
        },
        requestId: metadata?.requestId ?? null,
      },
    }),
  ]);

  return true;
}

/**
 * Revokes all non-revoked sessions for a specific target user.
 * Accepts either a PrismaClient or a Prisma Transaction client.
 */
export async function revokeAllUserSessions(
  db: PrismaClient | any,
  userId: string
): Promise<number> {
  if (!userId || typeof userId !== 'string') {
    return 0;
  }

  const now = new Date();
  const updateResult = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });

  return updateResult.count;
}

/**
 * Revalidates that a live stream session token remains active, non-expired, and non-revoked.
 * Called by SSE or real-time event stream heartbeat/ticks.
 * Returns true if active, or false if expired, revoked, or account is not ACTIVE (signalling stream termination).
 */
export async function verifyStreamSessionActive(
  prisma: PrismaClient,
  rawToken: string
): Promise<boolean> {
  const validated = await validateSession(prisma, rawToken);
  return validated !== null;
}
