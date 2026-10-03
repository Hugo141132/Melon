import { NextResponse } from 'next/server';
import { validateServerEnv } from '@/lib/env/server';
import { Logger } from '@/lib/observability/logger';
import { dispatchAlertEmails } from '@/lib/notifications/alert-notification-service';

const logger = new Logger({ serviceName: 'web:internal-alert-dispatch' });

export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const requestId = `req-${Date.now()}`;
  const { alertId } = await params;

  try {
    const env = validateServerEnv();

    // 1. Authenticate machine-to-machine internal request
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!env.INTERNAL_SERVICE_TOKEN) {
      logger.error('INTERNAL_SERVICE_TOKEN is not configured on the web server');
      return NextResponse.json(
        { success: false, error: 'Internal server configuration error' },
        { status: 500 }
      );
    }

    if (!token || token !== env.INTERNAL_SERVICE_TOKEN) {
      logger.warn('Unauthorized attempt to access internal alert dispatch route', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        alertId,
      });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'Missing alertId parameter' },
        { status: 400 }
      );
    }

    // 2. Perform decoupled email dispatching
    const result = await dispatchAlertEmails(alertId, { requestId });

    return NextResponse.json({
      success: result.success,
      data: result,
      meta: { requestId },
    });
  } catch (error: any) {
    logger.error('Internal alert dispatch failed with unexpected error', error, {
      alertId,
      requestId,
    });
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
