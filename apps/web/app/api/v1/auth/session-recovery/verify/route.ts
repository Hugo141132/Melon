import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  verifySessionRecoveryChallenge,
  InvalidRecoveryOtpError,
  ExpiredRecoveryOtpError,
  MaxRecoveryAttemptsExceededError,
  ChallengeNotFoundError,
  AccountStatusForbiddenError,
  SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
} from '@kebun-melon/database';
import { SessionRecoveryVerifyInputSchema } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';

export async function POST(request: Request) {
  const requestId = `req-rec-ver-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);

  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'session-recovery-verify',
    limit: env.RATE_LIMIT_LOGIN_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const body = SessionRecoveryVerifyInputSchema.parse(await request.json().catch(() => ({})));
    const result = await verifySessionRecoveryChallenge(prisma, body, {
      ipAddress,
      userAgent,
      requestId,
    });

    const primaryRole = result.user.activeRoles[0] ?? 'ADMIN';

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            role: primaryRole,
            activeRoles: result.user.activeRoles,
            accountStatus: result.user.accountStatus,
            preferredLocale: 'id',
          },
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );

    // Set new session HttpOnly cookie
    response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_ABSOLUTE_LIFETIME_SECONDS, // 8 hours
    });

    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (error: any) {
    let errResponse: NextResponse;
    if (error instanceof ZodError || error?.name === 'ZodError') {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload format or extraneous fields present.',
            details: typeof error.flatten === 'function' ? error.flatten() : undefined,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    } else if (
      error instanceof InvalidRecoveryOtpError ||
      error?.name === 'InvalidRecoveryOtpError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: error.message,
            remainingAttempts: error.remainingAttempts,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    } else if (
      error instanceof ExpiredRecoveryOtpError ||
      error?.name === 'ExpiredRecoveryOtpError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'OTP_EXPIRED',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 410 }
      );
    } else if (
      error instanceof MaxRecoveryAttemptsExceededError ||
      error?.name === 'MaxRecoveryAttemptsExceededError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'MAX_ATTEMPTS_EXCEEDED',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 429 }
      );
    } else if (
      error instanceof ChallengeNotFoundError ||
      error?.name === 'ChallengeNotFoundError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHALLENGE_NOT_FOUND',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    } else if (
      error instanceof AccountStatusForbiddenError ||
      error?.name === 'AccountStatusForbiddenError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_FORBIDDEN',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    } else {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected internal error occurred while verifying recovery code.',
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
