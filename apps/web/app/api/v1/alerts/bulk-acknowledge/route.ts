import { NextRequest, NextResponse } from 'next/server';
import { prisma, AlertRepository } from '@kebun-melon/database';
import { UserRole, BulkAcknowledgeAlertsInputSchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'alert.acknowledge', 'ALERT', undefined, request);

    const body = await request.json().catch(() => ({}));
    const parsedBody = BulkAcknowledgeAlertsInputSchema.parse(body);

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
    const result = await alertRepo.acknowledgeAlertsBulk(
      session.id,
      {
        alertIds: parsedBody.alertIds,
        note: parsedBody.note || undefined,
      },
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
    if (error?.name === 'ZodError' || error?.issues) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: error.issues,
          },
          meta: { requestId },
        },
        { status: 422 }
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
          message: 'An unexpected error occurred while bulk acknowledging alerts.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
