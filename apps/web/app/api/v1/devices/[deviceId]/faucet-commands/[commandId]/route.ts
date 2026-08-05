import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, FaucetCommandRepository } from '@kebun-melon/database';
import {
  requireSession,
  requirePermission,
  requireDeviceViewAccess,
  AuthorizationError,
} from '@/lib/auth/rbac';

export async function GET(
  request: Request,
  { params }: { params: { deviceId: string; commandId: string } }
) {
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;
  const targetCommandId = params.commandId;

  try {
    const session = await requireSession(request);
    requirePermission(
      session,
      'device.control.history.read',
      'FAUCET_COMMAND',
      targetCommandId,
      request
    );

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
      isDeviceAssignedToUser: async (userId: string, devId: string) => {
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

    const faucetRepo = new FaucetCommandRepository(prisma);
    const command = await faucetRepo.getCommandById(targetCommandId);

    if (!command || (command.deviceId !== device.id && command.deviceId !== device.deviceId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FAUCET_COMMAND_NOT_FOUND',
            message: `Faucet command '${targetCommandId}' was not found for device '${targetDeviceId}'.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: command,
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
          message: 'An unexpected error occurred while fetching faucet command details.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
