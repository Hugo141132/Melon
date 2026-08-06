import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { OwnerUserProfileUpdateInputSchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'profile.other.read', 'USER', params.userId, request);

    const userRepo = new UserRepository(prisma);
    const user = await userRepo.getUserManagementById(params.userId);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: `User with ID '${params.userId}' could not be found.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: user,
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
          message: 'An unexpected internal error occurred while fetching user detail.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'profile.other.update', 'USER', params.userId, request);

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

    // Strict validation using OwnerUserProfileUpdateInputSchema
    // Rejects email, role, accountStatus, passwordHash, id, or extraneous keys with 422
    const parseResult = OwnerUserProfileUpdateInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile update request payload.',
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
    const result = await userRepo.updateOtherUserProfile({
      targetUserId: params.userId,
      actorUserId: session.id,
      data: parseResult.data,
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

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: result.message || 'Failed to update user profile.',
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.user,
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
          message: 'An unexpected internal error occurred while updating user profile.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'account.deactivate', 'USER', params.userId, request);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Optional body
    }

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.deleteUserPermanently({
      targetUserId: params.userId,
      actorUserId: session.id,
      reason: body?.reason,
      requestId,
    });

    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
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

      if (result.error === 'CANNOT_DELETE_PENDING_APPROVAL') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CANNOT_DELETE_PENDING_APPROVAL',
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
            message: result.message || 'Failed to delete user account.',
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { deletedUserId: params.userId },
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
          message: 'An unexpected internal error occurred while deleting user account.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
