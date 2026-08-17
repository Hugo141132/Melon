import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { ResetPasswordInputSchema } from '@kebun-melon/contracts';
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
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'reset-password',
    limit: env.RATE_LIMIT_RESET_PASSWORD_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = ResetPasswordInputSchema.parse(rawBody);

    if (
      body.newPasswordConfirmation !== undefined &&
      body.newPassword !== body.newPasswordConfirmation
    ) {
      const mismatchResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_CONFIRMATION_MISMATCH',
            message: 'New password and password confirmation do not match.',
          },
          meta: { requestId },
        },
        { status: 422 }
      );
      applyRateLimitToResponse(mismatchResponse, rateLimitInfo);
      return mismatchResponse;
    }

    const userRepository = new UserRepository(prisma);
    const result = await userRepository.resetPasswordWithToken({
      token: body.token,
      newPassword: body.newPassword,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'WEAK_PASSWORD') {
        statusCode = 422;
      } else if (result.error === 'ACCOUNT_NOT_ACTIVE') {
        statusCode = 403;
      } else if (result.error === 'INTERNAL_ERROR') {
        statusCode = 500;
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
        message: 'Password has been successfully reset.',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.fullName,
          },
          revokedSessionsCount: result.revokedSessionsCount,
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
          message: 'An unexpected error occurred while resetting password.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
