import { NextResponse } from 'next/server';
import { prisma, AlertRepository } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ alertId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'alert.read', 'ALERT', params.alertId, request);

    const alertId = params.alertId;

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
    const alert = await alertRepo.getAlertById(alertId, authorizedDeviceIds, session.id);

    if (!alert) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: `Alert '${alertId}' not found or access denied.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: alert,
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
          message: 'An unexpected error occurred while fetching alert details.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
