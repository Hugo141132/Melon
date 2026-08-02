import { NextResponse } from 'next/server';
import { prisma, DeviceRepository, TelemetryRepository } from '@kebun-melon/database';
import {
  DeviceType,
  DeviceConnectionStatus,
  SoilMonitoringResponseDto,
  WaterMonitoringResponseDto,
  LatestMonitoringSnapshotDto,
} from '@kebun-melon/contracts';
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

export async function GET(request: Request, { params }: { params: { deviceId: string } }) {
  const requestId = `req-latest-snapshot-${Date.now()}`;
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
    const waterReading = await telemetryRepo.getLatestWaterReading(device.id);
    const reservoirReading = await telemetryRepo.getLatestWaterTankReading(device.id);

    const isSoilStale =
      !soilReading ||
      device.connectionStatus === 'STALE' ||
      device.connectionStatus === 'OFFLINE' ||
      device.connectionStatus === 'UNKNOWN' ||
      device.connectionStatus === 'INACTIVE';

    const soilDto: SoilMonitoringResponseDto = {
      deviceId: device.deviceId,
      recordedAt: soilReading?.recordedAt ? soilReading.recordedAt.toISOString() : null,
      receivedAt: soilReading?.receivedAt ? soilReading.receivedAt.toISOString() : null,
      isStale: isSoilStale,
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

    const latestWaterReceivedAt =
      [waterReading?.receivedAt, reservoirReading?.receivedAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const latestWaterRecordedAt =
      [waterReading?.recordedAt, reservoirReading?.recordedAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const isWaterStale =
      !latestWaterReceivedAt ||
      device.connectionStatus === 'STALE' ||
      device.connectionStatus === 'OFFLINE' ||
      device.connectionStatus === 'UNKNOWN' ||
      device.connectionStatus === 'INACTIVE';

    const waterDto: WaterMonitoringResponseDto = {
      deviceId: device.deviceId,
      recordedAt: latestWaterRecordedAt ? latestWaterRecordedAt.toISOString() : null,
      receivedAt: latestWaterReceivedAt ? latestWaterReceivedAt.toISOString() : null,
      isStale: isWaterStale,
      data: {
        ph: toNumberOrNull(waterReading?.ph),
        tds: toNumberOrNull(waterReading?.tds),
        ec: toNumberOrNull(waterReading?.ec),
        tankVolume: toNumberOrNull(reservoirReading?.tankVolume),
        flowRate: toNumberOrNull(reservoirReading?.flowRate),
        status: reservoirReading?.status || waterReading?.status || null,
      },
    };

    const includeSoil = device.deviceType === 'SOIL_NODE' || !!soilReading;
    const includeWater =
      device.deviceType === 'WATER_QUALITY_NODE' ||
      device.deviceType === 'WATER_TANK_NODE' ||
      !!waterReading ||
      !!reservoirReading;

    const snapshotDto: LatestMonitoringSnapshotDto = {
      deviceId: device.deviceId,
      deviceType: device.deviceType as DeviceType,
      connectionStatus: device.connectionStatus as DeviceConnectionStatus,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
      soil: includeSoil ? soilDto : null,
      water: includeWater ? waterDto : null,
    };

    return NextResponse.json(
      {
        success: true,
        data: snapshotDto,
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
          message: 'An unexpected error occurred while fetching latest monitoring snapshot.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
