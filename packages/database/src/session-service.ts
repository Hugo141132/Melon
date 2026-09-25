import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  AccountStatus,
  UserRole,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  LoginInputSchema,
  SessionRecoveryChallengeInputSchema,
  SessionRecoveryVerifyInputSchema,
  RawDbUserWithRoles,
  AuditEventKey,
} from '@kebun-melon/contracts';
import { verifyPassword } from './password-service';

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_LAST_SEEN_THROTTLE_MS = 60 * 1000; // 1 minute throttle to prevent blocking DB writes on rapid requests
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

export class UnverifiedEmailError extends Error {
  constructor() {
    super('Email verification is required before accessing the account.');
    this.name = 'UnverifiedEmailError';
  }
}

export class ActiveSessionExistsError extends Error {
  constructor(public readonly canRecover = true) {
    super('An active session already exists for this account.');
    this.name = 'ActiveSessionExistsError';
  }
}

export class ExpiredRecoveryOtpError extends Error {
  constructor() {
    super('The recovery code has expired. Please request a new code.');
    this.name = 'ExpiredRecoveryOtpError';
  }
}

export class InvalidRecoveryOtpError extends Error {
  constructor(public readonly remainingAttempts: number) {
    super(`Invalid recovery code. ${remainingAttempts} attempt(s) remaining.`);
    this.name = 'InvalidRecoveryOtpError';
  }
}

export class MaxRecoveryAttemptsExceededError extends Error {
  constructor() {
    super('Maximum verification attempts exceeded. Please request a new recovery code.');
    this.name = 'MaxRecoveryAttemptsExceededError';
  }
}

export class ChallengeNotFoundError extends Error {
  constructor() {
    super('Recovery challenge not found or already consumed.');
    this.name = 'ChallengeNotFoundError';
  }
}

export class NoActiveSessionToRecoverError extends Error {
  constructor() {
    super('No active session exists to recover. Please log in normally.');
    this.name = 'NoActiveSessionToRecoverError';
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
  existingToken?: string;
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

  if (primaryRole === UserRole.OWNER && !user.emailVerifiedAt) {
    throw new UnverifiedEmailError();
  }

  const sessionId = crypto.randomUUID();

  await prisma.$transaction(
    async (tx) => {
      // 1. Lock the user row to prevent race conditions on concurrent logins
      await tx.$executeRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;

      // 2. Efficiently inspect unrevoked sessions for this user in a single round trip
      const thirtyMinsAgo = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
      const existingSessions = await tx.session.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const activeSessions = existingSessions.filter(
        (s) =>
          s.expiresAt > now &&
          (s.lastSeenAt ? s.lastSeenAt > thirtyMinsAgo : s.createdAt > thirtyMinsAgo)
      );

      if (activeSessions.length > 0) {
        // Strict single active session policy (DEC-AUTH-107 / SEC-AUTH-007):
        // Reject any new login attempt when an active session already exists,
        // preserving the live session intact without revocation.
        throw new ActiveSessionExistsError();
      } else if (existingSessions.length > 0) {
        // All unrevoked sessions are stale / expired / idle: prune them in a single batch
        await tx.session.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
      }

      // 3. Create new session, update user lastLoginAt, and synchronously write audit log
      await tx.session.create({
        data: {
          id: sessionId,
          sessionTokenHash,
          userId: user.id,
          expiresAt,
          lastSeenAt: now,
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });

      await tx.auditLog.create({
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
      });
    },
    {
      maxWait: 15000,
      timeout: 20000,
    }
  );

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
 * Checks 30-minute idle timeout, 8-hour absolute lifetime, and revalidates that the user's
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

  // 8-hour absolute lifetime check
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

  // Session is valid: update lastSeenAt only if beyond throttle threshold without blocking the request path
  const shouldUpdateLastSeen =
    !session.lastSeenAt ||
    now.getTime() - session.lastSeenAt.getTime() >= SESSION_LAST_SEEN_THROTTLE_MS;

  if (shouldUpdateLastSeen) {
    void prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      })
      .catch((err: any) => {
        if (err?.code !== 'P2025') {
          console.error('[validateSession] Failed to update lastSeenAt in background:', err);
        }
      });
  }

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

/**
 * Hashes a recovery OTP combined with its challenge ID using SHA-256.
 * The raw OTP is never stored in plaintext in the database.
 */
export function hashRecoveryOtp(challengeId: string, otp: string): string {
  return crypto.createHash('sha256').update(`${challengeId}:${otp}`).digest('hex');
}

export interface SessionRecoveryChallengeResult {
  challengeId: string;
  rawOtp: string;
  user: PublicSafeUserDto;
  expiresAt: Date;
  expiresInSeconds: number;
}

/**
 * Creates a single-use 60-second OTP challenge for forced session recovery.
 * Requires valid email and password to prevent unauthorized OTP dispatch.
 */
export async function createSessionRecoveryChallenge(
  prisma: PrismaClient,
  rawInput: unknown,
  _metadata?: LoginMetadata
): Promise<SessionRecoveryChallengeResult> {
  const input = SessionRecoveryChallengeInputSchema.parse(rawInput);
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

  const activeRoles: UserRole[] = user.userRoles
    .filter((ur) => ur.revokedAt === null && ur.role?.code)
    .map((ur) => ur.role.code as UserRole);

  const primaryRole = activeRoles[0] ?? UserRole.ADMIN;
  if (primaryRole === UserRole.OWNER && !user.emailVerifiedAt) {
    throw new UnverifiedEmailError();
  }

  const now = new Date();
  const activeSession = await prisma.session.findFirst({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });

  if (!activeSession) {
    throw new NoActiveSessionToRecoverError();
  }

  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const challengeId = crypto.randomUUID();
  const otpHash = hashRecoveryOtp(challengeId, rawOtp);
  const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

  await prisma.$transaction(async (tx) => {
    // Invalidate existing pending challenges for this user
    await tx.sessionRecoveryChallenge.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    // Create new challenge
    await tx.sessionRecoveryChallenge.create({
      data: {
        id: challengeId,
        userId: user.id,
        otpHash,
        expiresAt,
        maxAttempts: 3,
        attempts: 0,
      },
    });
  });

  return {
    challengeId,
    rawOtp,
    user: toPublicSafeUserDto(user as any),
    expiresAt,
    expiresInSeconds: 60,
  };
}

/**
 * Verifies a session recovery challenge OTP.
 * On success, atomically revokes all existing active sessions, creates a new session,
 * writes an audit log, and returns the new raw session token.
 */
export async function verifySessionRecoveryChallenge(
  prisma: PrismaClient,
  rawInput: unknown,
  metadata?: LoginMetadata
): Promise<LoginResult> {
  const input = SessionRecoveryVerifyInputSchema.parse(rawInput);
  const now = new Date();

  const challenge = await prisma.sessionRecoveryChallenge.findUnique({
    where: { id: input.challengeId },
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

  if (!challenge || challenge.consumedAt !== null) {
    throw new ChallengeNotFoundError();
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new MaxRecoveryAttemptsExceededError();
  }

  if (now > challenge.expiresAt) {
    throw new ExpiredRecoveryOtpError();
  }

  const expectedHash = hashRecoveryOtp(challenge.id, input.otp);
  const isMatch =
    challenge.otpHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(challenge.otpHash), Buffer.from(expectedHash));

  if (!isMatch) {
    const newAttempts = challenge.attempts + 1;
    const isExceeded = newAttempts >= challenge.maxAttempts;
    await prisma.sessionRecoveryChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: newAttempts,
        consumedAt: isExceeded ? now : null,
      },
    });

    if (isExceeded) {
      throw new MaxRecoveryAttemptsExceededError();
    }
    throw new InvalidRecoveryOtpError(challenge.maxAttempts - newAttempts);
  }

  // OTP verified: execute atomic session recovery in locked transaction
  const user = challenge.user;
  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new AccountStatusForbiddenError(user.accountStatus as AccountStatus);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_LIFETIME_MS);
  const sessionId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    // 1. Lock user row to prevent concurrent race conditions
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;

    // 2. Mark challenge consumed
    await tx.sessionRecoveryChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });

    // 3. Revoke all previous active sessions
    await tx.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    // 4. Create new single active session
    await tx.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionTokenHash,
        expiresAt,
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    });

    // 5. Synchronous audit log
    await tx.auditLog.create({
      data: {
        eventKey: AuditEventKey.AUTH_SESSION_FORCE_RECOVERED,
        actorUserId: user.id,
        targetType: 'User',
        targetId: user.id,
        result: 'SUCCESS',
        metadata: {
          sessionId,
          recoveryMethod: 'EMAIL_OTP',
          challengeId: challenge.id,
        },
        requestId: metadata?.requestId ?? null,
        ipAddress: metadata?.ipAddress ?? 'unknown',
        userAgent: metadata?.userAgent ?? 'unknown',
      },
    });
  });

  // Non-blocking lastLoginAt update
  prisma.user
    .update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    })
    .catch(() => {});

  return {
    rawToken,
    user: toPublicSafeUserDto(user as any),
  };
}
