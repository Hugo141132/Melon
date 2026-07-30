import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  loginUser,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
} from '@kebun-melon/database';
import { AccountStatus } from '@kebun-melon/contracts';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const result = await loginUser(prisma, body, { ipAddress, userAgent, requestId });

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

    return response;
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload format or extraneous fields present.',
            details: error.flatten(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    if (error instanceof InvalidCredentialsError || error?.name === 'InvalidCredentialsError') {
      return NextResponse.json(
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
    }

    if (
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

      return NextResponse.json(
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
    }

    return NextResponse.json(
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
}
