import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  createSessionRecoveryChallenge,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  UnverifiedEmailError,
  NoActiveSessionToRecoverError,
} from '@kebun-melon/database';
import { AccountStatus, SessionRecoveryChallengeInputSchema } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';
import { sendSessionRecoveryOtpEmail } from '@/lib/email/resend';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function POST(request: Request) {
  const requestId = `req-rec-chal-${Date.now()}`;
  const env = validateServerEnv();
  const clientIp = getClientIp(request);

  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'session-recovery-challenge',
    limit: env.RATE_LIMIT_LOGIN_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const body = SessionRecoveryChallengeInputSchema.parse(await request.json().catch(() => ({})));
    const result = await createSessionRecoveryChallenge(prisma, body);

    // Dispatch OTP email via Resend
    await sendSessionRecoveryOtpEmail({
      toEmail: result.user.email,
      recipientName: result.user.fullName,
      code: result.rawOtp,
      locale: env.DEFAULT_LOCALE || 'id',
      requestId,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          challengeId: result.challengeId,
          expiresAt: result.expiresAt.toISOString(),
          expiresInSeconds: result.expiresInSeconds,
          maskedEmail: maskEmail(result.user.email),
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );

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
      error instanceof InvalidCredentialsError ||
      error?.name === 'InvalidCredentialsError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    } else if (
      error instanceof AccountStatusForbiddenError ||
      error?.name === 'AccountStatusForbiddenError'
    ) {
      let code = 'ACCOUNT_FORBIDDEN';
      if (error.status === AccountStatus.PENDING_APPROVAL) {
        code = 'ACCOUNT_PENDING_APPROVAL';
      } else if (error.status === AccountStatus.APPROVED) {
        code = 'ACCOUNT_APPROVED_NOT_ACTIVE';
      } else if (error.status === AccountStatus.REJECTED) {
        code = 'ACCOUNT_REJECTED';
      } else if (error.status === AccountStatus.SUSPENDED) {
        code = 'ACCOUNT_SUSPENDED';
      } else if (error.status === AccountStatus.DEACTIVATED) {
        code = 'ACCOUNT_DEACTIVATED';
      }

      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    } else if (error instanceof UnverifiedEmailError || error?.name === 'UnverifiedEmailError') {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    } else if (
      error instanceof NoActiveSessionToRecoverError ||
      error?.name === 'NoActiveSessionToRecoverError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ACTIVE_SESSION',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    } else {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected internal error occurred while generating recovery code.',
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
