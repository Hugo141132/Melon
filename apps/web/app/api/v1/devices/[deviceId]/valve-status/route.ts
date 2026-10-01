import { NextResponse } from 'next/server';
import { prisma, DeviceRepository } from '@kebun-melon/database';
import { requireSession, requireDeviceViewAccess, AuthorizationError } from '@/lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-valve-status-${Date.now()}`;
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
        return Boolean(assignment);
      },
    });

    const latest = await deviceRepo.getLatestValveStatus(device.id);
    const history = await deviceRepo.getValveStatusHistory(device.id, 5);

    return NextResponse.json({
      success: true,
      data: {
        deviceId: device.deviceId,
        physicalState: latest?.status ?? 'UNKNOWN',
        latest,
        history,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code || (err.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN'),
            message: err.message,
          },
          meta: { requestId },
        },
        { status: err.statusCode }
      );
    }

    if (err.message?.includes('AUTHENTICATION_REQUIRED') || err.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred while fetching valve status.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
