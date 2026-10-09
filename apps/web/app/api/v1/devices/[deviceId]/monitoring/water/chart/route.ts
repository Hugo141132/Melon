import { NextResponse } from 'next/server';
import { prisma, TelemetryRepository, DeviceNotFoundError } from '@kebun-melon/database';
import { WaterChartQuerySchema } from '@kebun-melon/contracts';
import {
  getSessionOrNull,
  requireActiveAccount,
  requirePermission,
  AuthorizationError,
} from '@/lib/auth/rbac';

import { parseAndValidateDateRange, MAX_RANGE_MS } from '@/lib/monitoring/date-range';

/**
 * GET /api/v1/devices/[deviceId]/monitoring/water/chart
 *
 * Water-quality counterpart of the soil chart endpoint.
 *
 * The portable device samples on a 1,000 ms cadence but only publishes every
 * 10,000 ms, so the retained history is a sparse series of real published
 * results. This endpoint replays those results exactly as stored: no synthetic
 * intermediate readings are generated from the gaps, and a missing measurement
 * stays null rather than being plotted as zero.
 */
export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-water-chart-${Date.now()}`;
  const deviceIdentifier = params.deviceId;

  try {
    const rawSession = await getSessionOrNull(request);
    if (!rawSession) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required.',
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    }

    try {
      const session = requireActiveAccount(rawSession);
      requirePermission(session, 'monitoring.history.read');
    } catch (error) {
      const status = error instanceof AuthorizationError ? error.statusCode : 403;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSION',
            message: 'Access denied: insufficient permission to read chart telemetry.',
          },
          meta: { requestId },
        },
        { status }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = WaterChartQuerySchema.safeParse({
      locationKey: searchParams.get('locationKey') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      metrics: searchParams.get('metrics') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A location must be selected before chart data can be loaded.',
            details: parsed.error.format(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    // Every stored metric for the location is returned; the client chooses which
    // series to plot, so no metric filtering happens server-side.
    const { locationKey, limit, cursor } = parsed.data;

    // Enforced server-side so an oversized range fails loudly instead of silently
    // returning only the newest `limit` rows.
    const range = parseAndValidateDateRange(parsed.data.from, parsed.data.to);
    if (range.errorResponse) {
      const maxDays = Math.floor(MAX_RANGE_MS / (24 * 60 * 60 * 1000));
      const requestedDays = Math.ceil(
        (new Date(parsed.data.to ?? Date.now()).getTime() -
          new Date(parsed.data.from ?? 0).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: range.errorResponse.code,
            message: range.errorResponse.message,
            maxRangeDays: maxDays,
            requestedRangeDays: Number.isFinite(requestedDays) ? requestedDays : null,
            suggestion: 'Narrow the selected date range and retry.',
          },
          meta: { requestId },
        },
        { status: range.errorResponse.statusCode }
      );
    }

    const { from, to } = range;

    const repository = new TelemetryRepository(prisma);
    const series = await repository.getWaterChartSeries({
      deviceIdentifier,
      locationKey,
      from,
      to,
      limit,
      cursor,
    });

    const locations = await repository.getWaterReadingLocations(deviceIdentifier);
    const selected = locations.find((l) => l.locationKey === locationKey) ?? null;

    return NextResponse.json(
      {
        success: true,
        data: {
          locationKey,
          locationName: selected?.locationName ?? null,
          from: from.toISOString(),
          to: to.toISOString(),
          points: series.series,
          nextCursor: series.nextCursor ?? null,
          totalPoints: series.totalRows,
          truncated: false,
        },
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error: any) {
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
    if (error instanceof Error && error.message.toLowerCase().includes('cursor')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CURSOR',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 404 ? 'DEVICE_NOT_FOUND' : 'INTERNAL_ERROR',
          message:
            status === 404
              ? 'Device not found for the requested identifier.'
              : 'Failed to load water chart series.',
        },
        meta: { requestId },
      },
      { status }
    );
  }
}
