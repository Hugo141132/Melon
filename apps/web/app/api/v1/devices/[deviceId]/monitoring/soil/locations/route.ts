import { NextResponse } from 'next/server';
import { prisma, TelemetryRepository, DeviceNotFoundError } from '@kebun-melon/database';
import {
  getSessionOrNull,
  requireActiveAccount,
  requirePermission,
  AuthorizationError,
} from '@/lib/auth/rbac';

/**
 * GET /api/v1/devices/[deviceId]/monitoring/soil/locations
 *
 * Distinct annotated locations for a soil device, used to populate the chart
 * location selector. The list is derived from existing readings only, so a
 * location appears exactly once no matter how many readings carry it.
 */
export async function GET(_request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-soil-locations-${Date.now()}`;

  try {
    const rawSession = await getSessionOrNull(_request);
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
            message: 'Access denied: insufficient permission to read reading locations.',
          },
          meta: { requestId },
        },
        { status }
      );
    }

    const repository = new TelemetryRepository(prisma);
    const locations = await repository.getSoilReadingLocations(params.deviceId);

    return NextResponse.json(
      {
        success: true,
        data: { locations },
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
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 404 ? 'DEVICE_NOT_FOUND' : 'INTERNAL_ERROR',
          message:
            status === 404
              ? 'Device not found for the requested identifier.'
              : 'Failed to list soil reading locations.',
        },
        meta: { requestId },
      },
      { status }
    );
  }
}
