import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import { validateServerEnv } from '@/lib/env/server';
import { logger } from '@/lib/observability/logger';
import { DependencyStatus, ReadinessStatus, WebReadinessResponseDto } from '@kebun-melon/contracts';

export const dynamic = 'force-dynamic';

/**
 * Public Readiness Endpoint per docs/API.md §24.2 and DEC-INF-078.
 * Verifies downstream dependencies: database, gateway, broker.
 * Returns HTTP 200 with status: 'ready' when all dependencies are healthy.
 * Returns HTTP 503 with status: 'degraded' | 'down' when any dependency is unavailable.
 */
export async function GET() {
  let isDbUp = false;
  let isGatewayUp = false;
  let isBrokerUp = false;

  // 1. Check Database Connectivity
  try {
    if (process.env.DATABASE_URL) {
      await prisma.$queryRaw`SELECT 1`;
      isDbUp = true;
    }
  } catch (err: any) {
    logger.warn('Database health check failed during /ready probe', {
      error: err?.message,
    });
    isDbUp = false;
  }

  // 2. Check Gateway & Broker Reachability via internal probe per DEC-INF-078
  let env: ReturnType<typeof validateServerEnv> | null = null;
  try {
    env = validateServerEnv();
  } catch {
    env = null;
  }

  if (env?.INTERNAL_GATEWAY_URL) {
    try {
      const headers: Record<string, string> = {};
      if (env.INTERNAL_SERVICE_TOKEN) {
        headers['Authorization'] = `Bearer ${env.INTERNAL_SERVICE_TOKEN}`;
      }

      const timeoutMs = env.INTERNAL_GATEWAY_TIMEOUT_MS || 2000;
      const res = await fetch(`${env.INTERNAL_GATEWAY_URL}/internal/v1/ready`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        isGatewayUp = true;
        isBrokerUp = data?.dependencies?.broker === 'up';
      } else if (res.status === 503) {
        // Gateway service is running and responsive, but reporting degraded downstream dependencies
        const data = await res.json().catch(() => null);
        isGatewayUp = true;
        isBrokerUp = data?.dependencies?.broker === 'up';
      } else {
        // Gateway responded with unexpected status (e.g. 401 Unauthorized or 404/500)
        logger.warn('Gateway returned unexpected status during /ready probe', {
          statusCode: res.status,
        });
        isGatewayUp = false;
        isBrokerUp = false;
      }
    } catch (err: any) {
      logger.warn('Gateway internal readiness probe failed or timed out', {
        error: err?.message,
      });
      isGatewayUp = false;
      isBrokerUp = false;
    }
  }

  const databaseStatus: DependencyStatus = isDbUp ? 'up' : 'down';
  const gatewayStatus: DependencyStatus = isGatewayUp ? 'up' : 'down';
  const brokerStatus: DependencyStatus = isBrokerUp ? 'up' : 'down';

  const isAllReady = isDbUp && isGatewayUp && isBrokerUp;
  let overallStatus: ReadinessStatus;
  let httpStatusCode: number;

  if (isAllReady) {
    overallStatus = 'ready';
    httpStatusCode = 200;
  } else if (!isDbUp) {
    overallStatus = 'down';
    httpStatusCode = 503;
  } else {
    overallStatus = 'degraded';
    httpStatusCode = 503;
  }

  const payload: WebReadinessResponseDto = {
    status: overallStatus,
    dependencies: {
      database: databaseStatus,
      gateway: gatewayStatus,
      broker: brokerStatus,
    },
  };

  return NextResponse.json(payload, { status: httpStatusCode });
}
