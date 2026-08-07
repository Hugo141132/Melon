import { NextResponse } from 'next/server';
import {

  prisma,
  UserRepository,
  SESSION_COOKIE_NAME,
} from '@kebun-melon/database';
import {
  requireSession,
  requireActiveAccount,
  AuthorizationError,
} from '@/lib/auth/rbac';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requireActiveAccount(session);

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword, newPasswordConfirmation } = body || {};

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password is required and must be a non-empty string.',
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    if (newPasswordConfirmation !== undefined && newPassword !== newPasswordConfirmation) {
      return NextResponse.json(
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
    }

    const ipAddress = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepository = new UserRepository(prisma);
    const result = await userRepository.changeUserPassword({
      userId: session.id,
      currentPassword: currentPassword || undefined,
      newPassword,
      actorUserId: session.id,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      let statusCode = 422;
      if (result.error === 'ACCOUNT_NOT_ACTIVE') {
        statusCode = 403;
      } else if (result.error === 'USER_NOT_FOUND') {
        statusCode = 404;
      } else if (result.error === 'INTERNAL_ERROR') {
        statusCode = 500;
      }

      return NextResponse.json(
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
    }

    const response = new NextResponse(null, { status: 204 });

    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while changing password.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
