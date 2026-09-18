import { NextResponse } from 'next/server';
import {
  prisma,
  DeviceRepository,
  DeviceNotFoundError,
  getExternalPredictionClient,
} from '@kebun-melon/database';
import { DeviceType, SoilPredictionDto, WaterPredictionDto } from '@kebun-melon/contracts';
import { requireSession, requireDeviceViewAccess, AuthorizationError } from '@/lib/auth/rbac';

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-pred-latest-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    // 1. Session authentication
    const session = await requireSession(request);

    // 2. Resolve target device by canonical ID or UUID from Melon database
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

    // 3. Enforce RBAC access (OWNER permitted; ADMIN requires active assignment)
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

    // 4. Resolve domain and fetch prediction (public endpoint always consumes cached prediction; forceRefresh is reserved for internal services)
    const client = getExternalPredictionClient();
    let prediction: SoilPredictionDto | WaterPredictionDto | null = null;

    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

    if (device.deviceType === DeviceType.SOIL_NODE) {
      const activeExternalId = await deviceRepo.getActiveExternalDeviceId(
        device.id,
        'SOIL',
        'EXTERNAL_ML'
      );

      if (!activeExternalId && isProduction) {
        return NextResponse.json({
          success: true,
          data: null,
          meta: {
            requestId,
            status: 'UNAVAILABLE',
            message: `No active external mapping configured for device '${device.deviceId}'.`,
          },
        });
      }

      const lookupDeviceId = activeExternalId || device.deviceId;
      prediction = await client.getLatestSoilPrediction(lookupDeviceId);

      if (!prediction && !isProduction && device.clientId && device.clientId !== lookupDeviceId) {
        prediction = await client.getLatestSoilPrediction(device.clientId);
      }
    } else if (device.deviceType === DeviceType.WATER_QUALITY_NODE) {
      const activeExternalId = await deviceRepo.getActiveExternalDeviceId(
        device.id,
        'WATER',
        'EXTERNAL_ML'
      );

      if (!activeExternalId && isProduction) {
        return NextResponse.json({
          success: true,
          data: null,
          meta: {
            requestId,
            status: 'UNAVAILABLE',
            message: `No active external mapping configured for device '${device.deviceId}'.`,
          },
        });
      }

      const lookupDeviceId = activeExternalId || device.deviceId;
      prediction = await client.getLatestWaterPrediction(lookupDeviceId);

      if (!prediction && !isProduction && device.clientId && device.clientId !== lookupDeviceId) {
        prediction = await client.getLatestWaterPrediction(device.clientId);
      }
    } else {
      // Unsupported device types (e.g. WATER_TANK_NODE) return safe unavailable response
      return NextResponse.json({
        success: true,
        data: null,
        meta: {
          requestId,
          status: 'UNSUPPORTED',
          message: `Predictions are not supported for device type '${device.deviceType}'.`,
        },
      });
    }

    // 5. Fail-safe unavailable behavior: if prediction is null/malformed, return data: null without fabricating values
    if (!prediction) {
      return NextResponse.json({
        success: true,
        data: null,
        meta: {
          requestId,
          status: 'UNAVAILABLE',
          message: `No prediction available for device '${device.deviceId}'.`,
        },
      });
    }

    // 6. Return canonical DTO: mask internal/external device ID to Melon canonical deviceId, omit raw external fields & secrets
    const safeCanonicalDto = {
      id: prediction.id,
      deviceId: device.deviceId,
      readingId: prediction.readingId ?? null,
      predictedClass: prediction.predictedClass,
      confidence: prediction.confidence ?? null,
      features: prediction.features ?? null,
      actions: prediction.actions ?? null,
      summary: prediction.summary ?? '',
      farmerAction: prediction.farmerAction ?? null,
      issues: prediction.issues ?? null,
      modelVersion: prediction.modelVersion ?? null,
      createdAt: prediction.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: safeCanonicalDto,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
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
          message: 'An unexpected error occurred while fetching latest prediction.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
