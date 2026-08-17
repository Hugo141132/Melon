import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { VerifyEmailInputSchema } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);

  // Reuse the reset password rate limit or create a new one, here we reuse the register or reset window size,
  // but using a separate key prefix.
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'verify-email',
    limit: 5, // 5 attempts per window
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = VerifyEmailInputSchema.parse(rawBody);

    const userRepository = new UserRepository(prisma);
    const result = await userRepository.verifyEmailWithToken({
      token: body.token,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'INTERNAL_ERROR') {
        statusCode = 500;
      } else if (result.error === 'CONCURRENCY_CONFLICT') {
        statusCode = 409;
      }

      const errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
          meta: { requestId },
        },
        { status: statusCode }
      );
      applyRateLimitToResponse(errResponse, rateLimitInfo);
      return errResponse;
    }

    const response = NextResponse.json(
      {
        success: true,
        message: 'Email address has been successfully verified.',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.fullName,
            accountStatus: result.user.accountStatus,
            emailVerifiedAt: result.user.emailVerifiedAt,
          },
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
    if (error instanceof ZodError || error?.name === 'ZodError') {
      const errResponse = NextResponse.json(
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
      applyRateLimitToResponse(errResponse, rateLimitInfo);
      return errResponse;
    }

    const errResponse = NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while verifying email.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
