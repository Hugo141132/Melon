import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';
import { requireSession, requireRole, AuthorizationError } from '../../../../../lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;

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

    const targetUserId = params.userId;
    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target userId parameter is required.',
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const userRepo = new UserRepository(prisma);
    const item = await userRepo.getPendingApprovalById(targetUserId);

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pending admin registration not found.',
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: item,
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while fetching registration detail.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
