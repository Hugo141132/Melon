import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { prisma, DeviceRepository, TelemetryRepository } from '@kebun-melon/database';
import { WaterHistoryQuerySchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  requireDeviceViewAccess,
  AuthorizationError,
} from '@/lib/auth/rbac';
import { parseAndValidateDateRange } from '@/lib/monitoring/date-range';

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-water-history-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'monitoring.history.read');

    const deviceRepo = new DeviceRepository(prisma);
    const device = await deviceRepo.getDeviceByCanonicalId(targetDeviceId);

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: `Device '${targetDeviceId}' was not found.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    if (device.deviceType === 'SOIL_NODE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Device '${targetDeviceId}' is of type '${device.deviceType}' and does not support water monitoring.`,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    await requireDeviceViewAccess(session, targetDeviceId, {
      isDeviceAssignedToUser: async (userId, devId) => {
        const cleanDevId = devId.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          cleanDevId
        );
        const assignment = await prisma.userDeviceAccess.findFirst({
          where: {
            userId,
            revokedAt: null,
            device: isUuid
              ? {
                  OR: [
                    { id: cleanDevId },
                    { deviceId: cleanDevId },
                    { deviceId: { equals: cleanDevId, mode: 'insensitive' } },
                  ],
                }
              : {
                  OR: [
                    { deviceId: cleanDevId },
                    { deviceId: { equals: cleanDevId, mode: 'insensitive' } },
                  ],
                },
          },
        });
        return !!assignment;
      },
    });

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const parsedQuery = WaterHistoryQuerySchema.safeParse(queryParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters provided.',
            details: parsedQuery.error.format(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const { from: fromParam, to: toParam, metrics: metricsStr, page, pageSize } = parsedQuery.data;

    const dateRange = parseAndValidateDateRange(fromParam, toParam);
    if (dateRange.errorResponse) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: dateRange.errorResponse.code,
            message: dateRange.errorResponse.message,
          },
          meta: { requestId },
        },
        { status: dateRange.errorResponse.statusCode }
      );
    }

    const metrics = metricsStr
      ? metricsStr
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

    const telemetryRepo = new TelemetryRepository(prisma);
    const historyResult = await telemetryRepo.getWaterHistory({
      deviceIdentifier: device.id,
      from: dateRange.from,
      to: dateRange.to,
      metrics,
      page,
      pageSize,
    });

    return NextResponse.json(
      {
        success: true,
        data: historyResult,
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

    logger.error('Unexpected error fetching water monitoring history', error, {
      deviceId: targetDeviceId,
      requestId,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching water monitoring history.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
