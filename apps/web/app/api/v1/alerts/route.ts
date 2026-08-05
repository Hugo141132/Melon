import { NextResponse } from 'next/server';
import { prisma, AlertRepository } from '@kebun-melon/database';
import { AlertQueryInputSchema, UserRole } from '@kebun-melon/contracts';
import { requireSession, requirePermission, AuthorizationError } from '../../../../lib/auth/rbac';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '../../../../lib/rate-limit';
import { validateServerEnv } from '../../../../lib/env/server';

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'alert.read', 'ALERT', undefined, request);

    const env = validateServerEnv();
    const rateLimitIdentifier = session.id || getClientIp(request);
    const rateLimitInfo = checkRateLimit(rateLimitIdentifier, {
      keyPrefix: 'history',
      limit: env.RATE_LIMIT_HISTORY_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(rateLimitInfo, requestId);
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      page: searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      pageSize: searchParams.has('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 20,
      deviceId: searchParams.get('deviceId') || undefined,
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || undefined,
      alertType: searchParams.get('alertType') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      sort: searchParams.get('sort') || 'openedAt:desc',
    };

    const parseResult = AlertQueryInputSchema.safeParse(rawQuery);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters for alert listing.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

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
    const result = await alertRepo.getAlerts(parseResult.data, authorizedDeviceIds, session.id);

    const response = NextResponse.json(
      {
        success: true,
        data: result.items,
        meta: {
          requestId,
          pagination: result.pagination,
        },
      },
      { status: 200 }
    );
    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
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
          message: 'An unexpected error occurred while fetching alerts.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
