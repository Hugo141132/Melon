import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { BulkDeleteUsersInputSchema, DEFAULT_DELETION_REASON } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';
import { sendAccountDeletionEmail } from '../../../../../lib/email/resend';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'account.deactivate', 'USER', 'bulk', request);

    let body: unknown;
    try {
      const text = await request.text();
      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request payload with userIds and reason is required.',
            },
            meta: { requestId },
          },
          { status: 422 }
        );
      }
      body = JSON.parse(text);
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

    const parseResult = BulkDeleteUsersInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid bulk delete payload.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const { userIds, reason: inputReason } = parseResult.data;
    const reason = inputReason?.trim() || DEFAULT_DELETION_REASON;

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.bulkDeleteUsers({
      actorUserId: session.id,
      targetUserIds: userIds,
      reason,
      requestId,
      ipAddress,
      userAgent,
      beforeDeleteNotifyFn: async (target) => {
        await sendAccountDeletionEmail({
          toEmail: target.email,
          recipientName: target.fullName,
          reason: target.reason || reason,
          requestId,
        });
      },
    });

    if (!result.success && result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BULK_DELETE_FAILED',
            message: 'None of the requested user accounts could be deleted.',
            details: result.errors,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          deletedCount: result.deletedCount,
          deletedUserIds: result.deletedUserIds,
          partialErrors: result.errors,
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
          message: 'An unexpected internal error occurred while deleting user accounts in bulk.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
