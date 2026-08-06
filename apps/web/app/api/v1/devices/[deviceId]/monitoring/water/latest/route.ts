import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, TelemetryRepository } from '@kebun-melon/database';
import { WaterMonitoringResponseDto } from '@kebun-melon/contracts';
import { requireSession, requireDeviceViewAccess, AuthorizationError } from '@/lib/auth/rbac';

const toNumberOrNull = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    return val.toNumber();
  }
  const num = Number(val);
  return isNaN(num) ? null : num;
};

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-water-latest-${Date.now()}`;
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
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          devId
        );
        const assignment = await prisma.userDeviceAccess.findFirst({
          where: {
            userId,
            revokedAt: null,
            device: isUuid ? { OR: [{ id: devId }, { deviceId: devId }] } : { deviceId: devId },
          },
        });
        return !!assignment;
      },
    });

    const telemetryRepo = new TelemetryRepository(prisma);
    const waterReading = await telemetryRepo.getLatestWaterReading(device.id);
    const reservoirReading = await telemetryRepo.getLatestWaterTankReading(device.id);

    const latestReceivedAt =
      [waterReading?.receivedAt, reservoirReading?.receivedAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const latestRecordedAt =
      [waterReading?.recordedAt, reservoirReading?.recordedAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const isStale =
      !latestReceivedAt ||
      device.connectionStatus === 'STALE' ||
      device.connectionStatus === 'OFFLINE' ||
      device.connectionStatus === 'UNKNOWN' ||
      device.connectionStatus === 'INACTIVE';

    const responseData: WaterMonitoringResponseDto = {
      deviceId: device.deviceId,
      recordedAt: latestRecordedAt ? latestRecordedAt.toISOString() : null,
      receivedAt: latestReceivedAt ? latestReceivedAt.toISOString() : null,
      isStale,
      data: {
        ph: toNumberOrNull(waterReading?.ph),
        tds: toNumberOrNull(waterReading?.tds),
        ec: toNumberOrNull(waterReading?.ec),
        tankVolume: toNumberOrNull(reservoirReading?.tankVolume),
        flowRate: toNumberOrNull(reservoirReading?.flowRate),
        status: reservoirReading?.status || waterReading?.status || null,
      },
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
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
          message: 'An unexpected error occurred while fetching latest water monitoring data.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
