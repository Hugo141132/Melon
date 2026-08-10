import { NextResponse } from 'next/server';
import {
  prisma,
  TelemetryRepository,
  DeviceNotFoundError,
  DeviceInactiveError,
} from '@kebun-melon/database';
import { WaterTelemetryPayloadSchema } from '@kebun-melon/contracts';

/**
 * HTTPS REST API Water Telemetry Ingestion Endpoint
 *
 * Path B: ESP32/NodeMCU Water Quality Monitoring Equipment transmits telemetry
 * via REST API over Wi-Fi directly to this Web Backend ingestion endpoint.
 *
 * Path: POST /api/v1/devices/[deviceId]/telemetry/water
 *
 * BAT = Battery power level (%) or voltage (V) incorporated into water node equipment (DEC-MON-085).
 * Latitude and Longitude parameters are deleted per DEC-MON-085; coordinate bounds [-90, 90] & [-180, 180] are enforced during schema validation.
 */
export async function POST(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pathDeviceId = params.deviceId;

  try {
    // 1. Device Authentication Header Check (Require X-Device-Id header matching path)
    const headerDeviceId = request.headers.get('x-device-id');
    if (!headerDeviceId || headerDeviceId !== pathDeviceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED_DEVICE',
            message: !headerDeviceId
              ? 'Device authentication header X-Device-Id is missing.'
              : `X-Device-Id header '${headerDeviceId}' does not match URL path parameter '${pathDeviceId}'.`,
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    }

    // 2. Parse Request JSON Body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body must be a valid JSON object.',
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    // 3. Path vs Payload Device ID Match Validation
    if (body.deviceId && body.deviceId !== pathDeviceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_ID_MISMATCH',
            message: `Payload deviceId '${body.deviceId}' does not match URL path deviceId '${pathDeviceId}'.`,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    // 4. Validate Water Telemetry Schema (enforces coordinate bounds & finite numbers)
    const parseResult = WaterTelemetryPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Water telemetry payload schema validation failed.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    // 5. Ingest Telemetry into PostgreSQL (Handles DB lookup, idempotency, atomic device lastSeenAt update)
    const telemetryRepo = new TelemetryRepository(prisma);
    const result = await telemetryRepo.ingestWaterReading({
      deviceId: pathDeviceId,
      messageId: parseResult.data.messageId,
      schemaVersion: parseResult.data.schemaVersion,
      sequenceNumber: parseResult.data.sequence,
      recordedAt: parseResult.data.recordedAt || parseResult.data.timestamp,
      ph: parseResult.data.data.ph,
      tds: parseResult.data.data.tds,
      ec: parseResult.data.data.ec,
      status: parseResult.data.data.status,
    });

    const statusCode = result.isDuplicate ? 200 : 201;

    return NextResponse.json(
      {
        success: true,
        data: {
          readingId: result.readingId,
          deviceId: result.deviceId,
          canonicalDeviceId: result.canonicalDeviceId,
          messageId: result.messageId,
          recordedAt: result.recordedAt ? result.recordedAt.toISOString() : null,
          receivedAt: result.receivedAt.toISOString(),
          isDuplicate: result.isDuplicate,
          validationStatus: result.validationStatus,
        },
        meta: { requestId },
      },
      { status: statusCode }
    );
  } catch (error: any) {
    if (error instanceof DeviceNotFoundError || error?.name === 'DeviceNotFoundError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: error.message || `Device '${pathDeviceId}' was not found.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    if (error instanceof DeviceInactiveError || error?.name === 'DeviceInactiveError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_INACTIVE',
            message: error.message || `Device '${pathDeviceId}' is not active.`,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during water telemetry ingestion.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
