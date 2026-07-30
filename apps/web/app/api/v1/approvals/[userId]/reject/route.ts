import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';
import { requireSession, requireRole, AuthorizationError } from '../../../../../../lib/auth/rbac';

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;
  const userId = params.userId;

  try {
    let session;
    try {
      session = await requireSession(request);
      requireRole(session, UserRole.OWNER);
    } catch (err: any) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
            meta: { requestId },
          },
          { status: err.statusCode }
        );
      }
      throw err;
    }

    // Parse and validate optional decisionNote from body
    let decisionNote: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.decisionNote === 'string') {
        const trimmed = body.decisionNote.trim();
        if (trimmed.length > 1000) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Catatan penolakan (decisionNote) maksimal 1000 karakter.',
              },
              meta: { requestId },
            },
            { status: 422 }
          );
        }
        decisionNote = trimmed;
      }
    } catch {
      // Empty body is acceptable
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;
    const userRepo = new UserRepository(prisma);

    const result = await userRepo.rejectPendingAdmin({
      targetUserId: userId,
      decidedByUserId: session.id,
      decisionNote,
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

      if (result.error === 'INVALID_STATUS' || result.error === 'CONCURRENCY_CONFLICT') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: result.message,
              details: result.currentStatus ? { currentStatus: result.currentStatus } : undefined,
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
            message: result.message,
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
          user: result.user,
          approvalRecordId: result.approvalRecordId,
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred during account rejection.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
