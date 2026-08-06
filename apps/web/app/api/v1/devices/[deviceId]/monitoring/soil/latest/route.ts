import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, TelemetryRepository } from '@kebun-melon/database';
import { SoilMonitoringResponseDto } from '@kebun-melon/contracts';
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
  const requestId = `req-soil-latest-${Date.now()}`;
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
    const soilReading = await telemetryRepo.getLatestSoilReading(device.id);

    const isStale =
      !soilReading ||
      device.connectionStatus === 'STALE' ||
      device.connectionStatus === 'OFFLINE' ||
      device.connectionStatus === 'UNKNOWN' ||
      device.connectionStatus === 'INACTIVE';

    const responseData: SoilMonitoringResponseDto = {
      deviceId: device.deviceId,
      recordedAt: soilReading?.recordedAt ? soilReading.recordedAt.toISOString() : null,
      receivedAt: soilReading?.receivedAt ? soilReading.receivedAt.toISOString() : null,
      isStale,
      data: {
        nitrogen: toNumberOrNull(soilReading?.nitrogen),
        phosphorus: toNumberOrNull(soilReading?.phosphorus),
        potassium: toNumberOrNull(soilReading?.potassium),
        temperature: toNumberOrNull(soilReading?.temperature),
        moisture: toNumberOrNull(soilReading?.moisture),
        ph: toNumberOrNull(soilReading?.ph),
        ec: toNumberOrNull(soilReading?.ec),
        status: soilReading?.status || null,
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
          message: 'An unexpected error occurred while fetching latest soil monitoring data.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
