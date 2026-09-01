import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { realtimeEventHub } from '@/lib/realtime/event-hub';
import { validateServerEnv } from '@/lib/env/server';

export async function POST(request: Request) {
  try {
    const env = validateServerEnv();

    // 1. Authenticate the internal request
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
      logger.warn('Unauthorized attempt to access internal realtime publish webhook', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const body = await request.json().catch(() => ({}));

    if (!body.event || !body.event.name || !body.event.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload format. Expected { event: { name, data, deviceId? } }',
        },
        { status: 400 }
      );
    }

    // 3. Publish to RealtimeEventHub
    realtimeEventHub.publish({
      name: body.event.name,
      deviceId: body.event.deviceId,
      data: body.event.data,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error('Failed to process internal realtime publish webhook', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
