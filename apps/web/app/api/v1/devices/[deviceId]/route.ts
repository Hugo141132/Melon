import { NextResponse } from 'next/server';
import {
  prisma,
  DeviceRepository,
  DeviceNotFoundError,
  DeviceConflictError,
} from '@kebun-melon/database';
import { UpdateDeviceInputSchema, UserRole } from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  requireDeviceViewAccess,
  computeDevicePermissions,
  AuthorizationError,
} from '../../../../../lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);

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

    await requireDeviceViewAccess(session, targetDeviceId, {
      isDeviceAssignedToUser: async (userId, devId) => {
        const assignment = await prisma.userDeviceAccess.findFirst({
          where: {
            userId,
            revokedAt: null,
            device: {
              OR: [{ id: devId }, { deviceId: devId }],
            },
          },
        });
        return !!assignment;
      },
    });

    const permissions = computeDevicePermissions(session, device, true);
    const isOwner = session.activeRoles.includes(UserRole.OWNER);

    // Role-based projection per DEC-DEV-028:
    // OWNER: receives full device object including canonical deviceId.
    // ADMIN: canonical deviceId is strictly concealed (omitted).
    const projectedDevice = !isOwner
      ? (() => {
          const { deviceId: _concealed, ...adminDevice } = device;
          return { ...adminDevice, permissions };
        })()
      : { ...device, permissions };

    return NextResponse.json(
      {
        success: true,
        data: projectedDevice,
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
          message: 'An unexpected error occurred while retrieving device details.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.update', 'DEVICE', targetDeviceId, request);

    const body = await request.json().catch(() => ({}));
    const parseResult = UpdateDeviceInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid device update data.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const deviceRepo = new DeviceRepository(prisma);
    const updatedDevice = await deviceRepo.updateDevice(
      targetDeviceId,
      parseResult.data,
      session.id
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedDevice,
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

    if (error instanceof DeviceNotFoundError || error?.name === 'DeviceNotFoundError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating device.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.delete', 'DEVICE', targetDeviceId, request);

    const deviceRepo = new DeviceRepository(prisma);
    const deletedDevice = await deviceRepo.deleteDevicePermanently(targetDeviceId, session.id);

    return NextResponse.json(
      {
        success: true,
        data: deletedDevice,
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

    if (error instanceof DeviceNotFoundError || error?.name === 'DeviceNotFoundError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while permanently deleting device.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
