import { NextResponse } from 'next/server';
import { prisma, DeviceRepository } from '@kebun-melon/database';
import { DeviceQueryInputSchema, UserRole, DeviceConnectionStatus } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  computeDevicePermissions,
  AuthorizationError,
} from '../../../../lib/auth/rbac';
import { TELEMETRY_STALE_THRESHOLD_MS } from '@/lib/constants';

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.read', 'DEVICE', undefined, request);

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      page: searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      pageSize: searchParams.has('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 20,
      siteId: searchParams.get('siteId') || undefined,
      deviceType: searchParams.get('deviceType') || undefined,
      connectionStatus: searchParams.get('connectionStatus') || undefined,
      accountStatus: searchParams.get('accountStatus') || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') || 'createdAt:desc',
    };

    const parseResult = DeviceQueryInputSchema.safeParse(rawQuery);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters for device listing.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const deviceRepo = new DeviceRepository(prisma);

    // If ADMIN user, fetch their explicit assigned device IDs; if OWNER, leave undefined for global scope.
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

    const result = await deviceRepo.getDevices(parseResult.data, authorizedDeviceIds);

    const now = Date.now();
    const itemsWithPermissions = result.items.map((device) => {
      const isStale =
        device.connectionStatus === DeviceConnectionStatus.ONLINE &&
        (!device.lastSeenAt ||
          now - new Date(device.lastSeenAt).getTime() > TELEMETRY_STALE_THRESHOLD_MS);
      const effectiveConnectionStatus = isStale
        ? DeviceConnectionStatus.STALE
        : (device.connectionStatus as DeviceConnectionStatus);

      const deviceWithEffectiveStatus = {
        ...device,
        connectionStatus: effectiveConnectionStatus,
      };

      const permissions = computeDevicePermissions(session, deviceWithEffectiveStatus, true);
      if (!isOwner) {
        const { deviceId: _concealed, ...adminDevice } = deviceWithEffectiveStatus;
        return {
          ...adminDevice,
          permissions,
        };
      }
      return {
        ...deviceWithEffectiveStatus,
        permissions,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: itemsWithPermissions,
        meta: {
          requestId,
          pagination: result.pagination,
        },
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
          message: 'An unexpected error occurred while fetching device registry.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
