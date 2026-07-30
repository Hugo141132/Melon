import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, DeviceConflictError } from '@kebun-melon/database';
import { DeviceQueryInputSchema, CreateDeviceInputSchema } from '@kebun-melon/contracts';
import { requireSession, requirePermission, AuthorizationError } from '../../../../lib/auth/rbac';

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.read');

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
    const isOwner = session.activeRoles.includes('OWNER' as any);
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

    return NextResponse.json(
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

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.create');

    const body = await request.json().catch(() => ({}));
    const parseResult = CreateDeviceInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid device registration data.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const deviceRepo = new DeviceRepository(prisma);
    const createdDevice = await deviceRepo.createDevice(parseResult.data, session.id);

    return NextResponse.json(
      {
        success: true,
        data: createdDevice,
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

    if (error instanceof DeviceConflictError || error?.name === 'DeviceConflictError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_DEVICE_ID',
            message: error.message,
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
          message: 'An unexpected error occurred while creating device.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
