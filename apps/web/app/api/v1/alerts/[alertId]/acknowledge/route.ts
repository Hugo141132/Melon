import { NextRequest, NextResponse } from 'next/server';
import { prisma, AlertRepository, AlertNotFoundError } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../../lib/auth/rbac';

export async function POST(request: NextRequest, { params }: { params: { alertId: string } }) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'alert.acknowledge', 'ALERT', params.alertId, request);

    const alertId = params.alertId;
    const body = await request.json().catch(() => ({}));

    let authorizedDeviceIds: string[] | undefined = undefined;
    const isOwner = session.activeRoles.includes(UserRole.OWNER);
    if (!isOwner) {
      const userAssignments = await prisma.userDeviceAccess.findMany({
        where: {
          userId: session.id,
          revokedAt: null,
        },
        select: { deviceId: true },
      });
      authorizedDeviceIds = userAssignments.map((a) => a.deviceId);
    }

    const alertRepo = new AlertRepository(prisma);
    const result = await alertRepo.acknowledgeAlert(
      alertId,
      session.id,
      body.note,
      authorizedDeviceIds
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof AlertNotFoundError || error?.name === 'AlertNotFoundError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

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
          message: 'An unexpected error occurred while acknowledging alert.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
