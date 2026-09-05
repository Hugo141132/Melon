import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  loginUser,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  UnverifiedEmailError,
  ActiveSessionExistsError,
} from '@kebun-melon/database';
import { AccountStatus, LoginInputSchema } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';
import { extractSessionTokenFromRequest } from '@/lib/auth/rbac';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'login',
    limit: env.RATE_LIMIT_LOGIN_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const existingToken = await extractSessionTokenFromRequest(request);
    const body = LoginInputSchema.parse(await request.json().catch(() => ({})));
    const result = await loginUser(prisma, body, {
      ipAddress,
      userAgent,
      requestId,
      existingToken,
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
      error instanceof ActiveSessionExistsError ||
      error?.name === 'ActiveSessionExistsError'
    ) {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACTIVE_SESSION_EXISTS',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    } else {
      errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected internal error occurred during login.',
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
