import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserLifecycleActionInputSchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../../lib/auth/rbac';

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'account.activate');

    let reason: string | undefined = undefined;
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const body = JSON.parse(text);
        const parseResult = UserLifecycleActionInputSchema.safeParse(body);
        if (!parseResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request payload for activation.',
                details: parseResult.error.flatten(),
              },
              meta: { requestId },
            },
            { status: 422 }
          );
        }
        reason = parseResult.data.reason;
      }
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

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.activateUser({
      targetUserId: params.userId,
      actorUserId: session.id,
      reason,
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
              message: result.message,
            },
            meta: { requestId },
          },
          { status: 404 }
        );
      }

      if (result.error === 'FORBIDDEN_TARGET') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN_TARGET',
              message: result.message,
            },
            meta: { requestId },
          },
          { status: 403 }
        );
      }

      if (result.error === 'INVALID_STATUS_TRANSITION') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: result.message,
              currentStatus: result.currentStatus,
            },
            meta: { requestId },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: result.message || 'Failed to activate user.',
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: result.user.id,
          accountStatus: result.user.accountStatus,
        },
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
          message: 'An unexpected internal error occurred while activating user.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
