import { NextResponse } from 'next/server';
import { prisma, TelemetryRepository } from '@kebun-melon/database';
import {
  ReadingLocationAnnotationSchema,
  ReadingIdSchema,
  AuditEventKey,
  AuditResult,
} from '@kebun-melon/contracts';
import {
  getSessionOrNull,
  requireActiveAccount,
  requirePermission,
  AuthorizationError,
} from '@/lib/auth/rbac';

/**
 * POST /api/v1/devices/[deviceId]/monitoring/soil/location
 *
 * Binds (or clears) a human-readable location name onto ONE immutable soil
 * reading id.
 *
 * Invariants enforced here:
 * - The annotation is stored per reading id, never per device, so a device that
 *   is physically carried between beds keeps a correct per-reading location.
 * - The actor is derived from the authenticated server session; the request body
 *   can never nominate a different "Named by" user.
 * - Clearing is an explicit `locationName: null`, which is audited as its own
 *   event rather than being silently treated as a no-op.
 */
export async function POST(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-soil-location-${Date.now()}`;
  const deviceIdentifier = params.deviceId;

  try {
    // RBAC: the same permission that gates reading history also gates writing a
    // location onto a reading, because the write is meaningless without read
    // access to the underlying telemetry.
    const rawSession = await getSessionOrNull(request);
    if (!rawSession) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required to annotate a reading location.',
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    }

    // The annotation is a write against telemetry, so it must satisfy the same
    // account-status and permission gates as every other protected mutation.
    let session;
    try {
      session = requireActiveAccount(rawSession);
      requirePermission(session, 'monitoring.history.read');
    } catch (error) {
      const status = error instanceof AuthorizationError ? error.statusCode : 403;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSION',
            message: 'Access denied: insufficient permission to annotate a reading location.',
          },
          meta: { requestId },
        },
        { status }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body must be valid JSON.',
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const parsed = ReadingLocationAnnotationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reading location payload provided.',
            details: parsed.error.format(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const { locationName } = parsed.data;
    const readingIdResult = ReadingIdSchema.safeParse(
      (rawBody as { readingId?: unknown }).readingId
    );
    if (!readingIdResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A valid readingId is required.',
            details: readingIdResult.error.format(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }
    const readingId = readingIdResult.data;

    const repository = new TelemetryRepository(prisma);
    const result = await repository.setSoilReadingLocation({
      deviceIdentifier,
      readingId,
      locationName: locationName ?? null,
      // Actor comes from the server session only.
      namedByUserId: session.id,
    });

    if (!result.applied) {
      // The reading id does not belong to this device. Report 404 rather than
      // leaking whether some other device owns that id.
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'READING_NOT_FOUND',
            message: 'The reading does not exist for this device.',
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    const clearing = locationName === null || locationName.trim().length === 0;
    const reading = await prisma.soilReading.findUnique({
      where: { id: readingId },
      select: {
        id: true,
        locationName: true,
        locationKey: true,
        locationNamedById: true,
        locationAnnotatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        eventKey: clearing
          ? AuditEventKey.READING_LOCATION_CLEARED
          : AuditEventKey.READING_LOCATION_SET,
        actorUserId: session.id,
        actorRole: session.activeRoles[0] ?? null,
        targetType: 'SOIL_READING',
        targetId: readingId,
        result: AuditResult.SUCCESS,
        previousValues: clearing ? { locationName: result.previousLocationName } : undefined,
        newValues: clearing
          ? { locationName: null }
          : { locationName: reading?.locationName, locationKey: reading?.locationKey },
        metadata: { deviceId: deviceIdentifier, requestId },
        requestId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          readingId,
          locationName: reading?.locationName ?? null,
          locationKey: reading?.locationKey ?? null,
          namedAt: reading?.locationAnnotatedAt ? reading.locationAnnotatedAt.toISOString() : null,
        },
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to annotate the soil reading location.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
