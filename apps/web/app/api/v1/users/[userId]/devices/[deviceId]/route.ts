import { NextResponse } from 'next/server';
import { prisma, DeviceAssignmentRepository, DeviceAssignmentError } from '@kebun-melon/database';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../../../lib/auth/rbac';

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string; deviceId: string } }
) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.unassign');

    const clientIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const repo = new DeviceAssignmentRepository(prisma);
    await repo.revokeDeviceAssignment({
      userId: params.userId,
      deviceIdOrId: params.deviceId,
      actorUserId: session.id,

      requestId,
      ipAddress: clientIp,
      userAgent,
    });

    return new Response(null, { status: 204 });
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
      if (error.code === 'ASSIGNMENT_NOT_FOUND' || error.code === 'DEVICE_NOT_FOUND') {
        status = 404;
      } else if (error.code === 'UNAUTHORIZED_ACTOR') {
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
          message: 'An unexpected internal error occurred while revoking device assignment.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
