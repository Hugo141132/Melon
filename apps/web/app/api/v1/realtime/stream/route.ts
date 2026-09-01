import { NextResponse } from 'next/server';
import {
  requireSession,
  requireActiveAccount,
  requireDeviceViewAccess,
  extractSessionTokenFromRequest,
  AuthorizationError,
} from '@/lib/auth/rbac';
import { prisma, verifyStreamSessionActive } from '@kebun-melon/database';
import { realtimeEventHub, RealtimeMonitoringEvent } from '@/lib/realtime/event-hub';

export const dynamic = 'force-dynamic';

async function isDeviceAssignedToUser(userId: string, devId: string): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(devId);
  const assignment = await prisma.userDeviceAccess.findFirst({
    where: {
      userId,
      revokedAt: null,
      device: isUuid ? { OR: [{ id: devId }, { deviceId: devId }] } : { deviceId: devId },
    },
  });
  return !!assignment;
}

export async function GET(request: Request) {
  const token = await extractSessionTokenFromRequest(request);
  const requestId = crypto.randomUUID();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication session is required to perform this action.',
        },
        meta: { requestId },
      },
      { status: 401 }
    );
  }

  let session;
  try {
    session = await requireSession(request);
    requireActiveAccount(session);
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
          meta: { requestId },
        },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected authentication error occurred.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const targetDeviceId = searchParams.get('deviceId') || undefined;
  const channelsParam = searchParams.get('channels');

  const channelsFilter = channelsParam
    ? channelsParam.split(',').map((c) => c.trim().toLowerCase())
    : null;

  if (targetDeviceId) {
    try {
      await requireDeviceViewAccess(session, targetDeviceId, {
        isDeviceAssignedToUser,
      });
    } catch (err: any) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
            meta: { requestId },
          },
          { status: err.statusCode }
        );
      }
    }
  }

  // Resolve targetDeviceId to both UUID and canonical ID for accurate filtering
  let resolvedDeviceIds: string[] = [];
  if (targetDeviceId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        targetDeviceId
      );
      const device = prisma?.device?.findFirst
        ? await prisma.device.findFirst({
            where: isUuid
              ? { OR: [{ id: targetDeviceId }, { deviceId: targetDeviceId }] }
              : { deviceId: targetDeviceId },
            select: { id: true, deviceId: true },
          })
        : null;
      if (device) {
        resolvedDeviceIds = [device.id, device.deviceId];
      } else {
        resolvedDeviceIds = [targetDeviceId];
      }
    } catch {
      resolvedDeviceIds = [targetDeviceId];
    }
  }

  const encoder = new TextEncoder();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let unsubscribeEventHub: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Send initial connected event
      const connectedPayload = {
        event: 'connected',
        data: JSON.stringify({
          status: 'CONNECTED',
          userId: session.id,
          targetDeviceId: targetDeviceId || null,
          channels: channelsFilter || 'all',
          timestamp: new Date().toISOString(),
        }),
      };
      controller.enqueue(
        encoder.encode(`event: ${connectedPayload.event}\ndata: ${connectedPayload.data}\n\n`)
      );

      // 2. Subscribe to Realtime Event Hub
      unsubscribeEventHub = realtimeEventHub.subscribe((event: RealtimeMonitoringEvent) => {
        // Filter by deviceId if specified (matching against both UUID and canonical ID)
        if (targetDeviceId && event.deviceId) {
          if (!resolvedDeviceIds.includes(event.deviceId)) {
            return;
          }
        }

        // Filter by channel if specified
        if (channelsFilter && channelsFilter.length > 0) {
          const eventName = event.name.toLowerCase();
          const matchesChannel = channelsFilter.some((ch) => {
            if (ch === 'telemetry' && eventName.startsWith('telemetry.')) return true;
            if (ch === 'status' && eventName.startsWith('device.status.')) return true;
            if (ch === 'alerts' && eventName.startsWith('alert.')) return true;
            if (ch === 'commands' && eventName.startsWith('faucet.command.')) return true;
            return eventName.includes(ch);
          });

          // System events are always permitted
          const isSystemEvent = eventName === 'access.revoked' || eventName === 'session.expired';
          if (!matchesChannel && !isSystemEvent) {
            return;
          }
        }

        try {
          controller.enqueue(
            encoder.encode(`event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`)
          );
        } catch {
          // Stream controller closed
        }
      });

      // 3. Heartbeat & Session/Device Access Revalidation Loop (TASK-0908 Integration)
      const intervalMs = process.env.TEST_HEARTBEAT_INTERVAL_MS
        ? parseInt(process.env.TEST_HEARTBEAT_INTERVAL_MS, 10)
        : 5000;

      heartbeatTimer = setInterval(async () => {
        try {
          // Recheck session active status
          const isSessionActive = await verifyStreamSessionActive(prisma, token);
          if (!isSessionActive) {
            controller.enqueue(
              encoder.encode(
                `event: session.expired\ndata: ${JSON.stringify({
                  reason: 'SESSION_EXPIRED_OR_REVOKED',
                })}\n\n`
              )
            );
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            if (unsubscribeEventHub) unsubscribeEventHub();
            try {
              controller.close();
            } catch {}
            return;
          }

          // Recheck device access if bound to a target device
          if (targetDeviceId) {
            try {
              await requireDeviceViewAccess(session, targetDeviceId, {
                isDeviceAssignedToUser,
              });
            } catch {
              controller.enqueue(
                encoder.encode(
                  `event: access.revoked\ndata: ${JSON.stringify({
                    reason: 'DEVICE_ACCESS_REVOKED',
                    deviceId: targetDeviceId,
                  })}\n\n`
                )
              );
              if (heartbeatTimer) clearInterval(heartbeatTimer);
              if (unsubscribeEventHub) unsubscribeEventHub();
              try {
                controller.close();
              } catch {}
              return;
            }
          }

          // Ping heartbeat
          controller.enqueue(
            encoder.encode(
              `event: ping\ndata: ${JSON.stringify({
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
        } catch {
          // Suppress tick errors
        }
      }, intervalMs);
    },

    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubscribeEventHub) unsubscribeEventHub();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
