import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, DeviceNotFoundError } from '@kebun-melon/database';
import {
  requireSession,
  requirePermission,
  AuthorizationError,
} from '../../../../../../lib/auth/rbac';

export async function POST(request: Request, { params }: { params: { deviceId: string } }) {
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.deactivate', 'DEVICE', targetDeviceId, request);

    const deviceRepo = new DeviceRepository(prisma);
    const deactivatedDevice = await deviceRepo.deactivateDevice(targetDeviceId, session.id);

    return NextResponse.json(
      {
        success: true,
        data: deactivatedDevice,
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
          message: 'An unexpected error occurred while deactivating device.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
