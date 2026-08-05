import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  registerUser,
  DuplicateEmailError,
  PasswordPolicyError,
  MissingRoleError,
  OwnerAlreadyExistsError,
} from '@kebun-melon/database';
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

  const env = validateServerEnv();
  const clientIp = getClientIp(request);
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'register',
    limit: env.RATE_LIMIT_REGISTER_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await registerUser(prisma, body);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
        },
        meta: {
          requestId,
        },
      },
      { status: 201 }
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
    } else if (error instanceof OwnerAlreadyExistsError) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'OWNER_ALREADY_EXISTS',
            message: 'Akun Owner sudah terdaftar di sistem. Pendaftaran Owner tidak tersedia.',
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    } else if (error instanceof DuplicateEmailError) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    } else if (error instanceof PasswordPolicyError) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_POLICY_FAILED',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    } else if (error instanceof MissingRoleError) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'System role configuration error. Please contact system administrator.',
          },
          meta: { requestId },
        },
        { status: 503 }
      );
    } else {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected internal error occurred during registration.',
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
