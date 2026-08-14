import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserPreferenceUpdateInputSchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requireActiveAccount,
  requirePermission,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';

export async function PATCH(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requireActiveAccount(session);
    requirePermission(session, 'language.self.update', 'USER', session.id, request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON.',
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const parseResult = UserPreferenceUpdateInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preference update request payload.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.updateUserPreference({
      userId: session.id,
      preferredLocale: parseResult.data.preferredLocale,
      timezone: parseResult.data.timezone,
      defaultDeviceId: parseResult.data.defaultDeviceId,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      if (result.error === 'USER_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: result.message || 'User not found.',
            },
            meta: { requestId },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: result.message || 'Failed to update preferences.',
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.preferences,
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof AuthorizationError || error?.name === 'AuthorizationError') {
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
          message: 'An unexpected internal error occurred while updating user preferences.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
