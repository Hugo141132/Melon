import { NextResponse } from 'next/server';
import { prisma, DeviceAssignmentRepository, DeviceAssignmentError } from '@kebun-melon/database';
import { AssignDeviceInputSchema, ListUserDeviceAccessQuerySchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../../lib/auth/rbac';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    // Listing assignments for a user requires device.assign or profile.other.read (Owner-only)
    requirePermission(session, 'device.assign', 'USER_DEVICE', params.userId, request);

    const { searchParams } = new URL(request.url);
    const rawIncludeRevoked = searchParams.get('includeRevoked');
    const query = ListUserDeviceAccessQuerySchema.parse({
      includeRevoked: rawIncludeRevoked ?? undefined,
    });

    const repo = new DeviceAssignmentRepository(prisma);
    const assignments = await repo.listUserDeviceAssignments(params.userId, query);

    return NextResponse.json(
      {
        success: true,
        data: {
          assignments,
          totalCount: assignments.length,
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
          message: 'An unexpected internal error occurred while fetching device assignments.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.assign', 'USER_DEVICE', params.userId, request);

    const body = await request.json();
    const parseResult = AssignDeviceInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid assignment input body.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const clientIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const repo = new DeviceAssignmentRepository(prisma);
    const assignment = await repo.assignDeviceToUser({
      userId: params.userId,
      deviceIdOrId: parseResult.data.deviceId,
      actorUserId: session.id,

      requestId,
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: assignment,
        meta: { requestId },
      },
      { status: 201 }
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

    if (error instanceof DeviceAssignmentError || error?.name === 'DeviceAssignmentError') {
      let status = 400;
      if (error.code === 'USER_NOT_FOUND' || error.code === 'DEVICE_NOT_FOUND') {
        status = 404;
      } else if (error.code === 'ACTIVE_ASSIGNMENT_EXISTS') {
        status = 409;
      } else if (
        error.code === 'CANNOT_ASSIGN_OWNER' ||
        error.code === 'INVALID_USER_STATUS' ||
        error.code === 'UNAUTHORIZED_ACTOR'
      ) {
        status = 403;
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while assigning device.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
