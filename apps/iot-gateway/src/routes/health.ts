import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@kebun-melon/database';
import { GatewayMqttClient } from '../mqtt/client';
import { GatewayEnv } from '../config/env';

const startTime = Date.now();

export type DbChecker = () => Promise<boolean>;

export const defaultDbChecker: DbChecker = async () => {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export function registerHealthRoutes(
  app: FastifyInstance,
  mqttClient: GatewayMqttClient,
  dbChecker: DbChecker = defaultDbChecker,
  env?: GatewayEnv
): void {
  const getReadinessData = async () => {
    const mqttStatus = mqttClient.getStatus();
    const isMqttConnected = mqttClient.isConnected();
    const isDbConnected = await dbChecker();

    const dbStatus = isDbConnected ? 'CONNECTED' : 'DISCONNECTED';

    let overallStatus: 'UP' | 'DEGRADED' | 'DOWN';
    let canonicalStatus: 'ready' | 'degraded' | 'down';
    let statusCode: number;

    if (!isDbConnected) {
      overallStatus = 'DOWN';
      canonicalStatus = 'down';
      statusCode = 503;
    } else if (isMqttConnected) {
      overallStatus = 'UP';
      canonicalStatus = 'ready';
      statusCode = 200;
    } else {
      overallStatus = 'DEGRADED';
      canonicalStatus = 'degraded';
      statusCode = 503;
    }

    return {
      statusCode,
      canonicalStatus,
      overallStatus,
      mqttStatus,
      isMqttConnected,
      dbStatus,
      isDbConnected,
    };
  };

  // Public Liveness Endpoint
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'pass',
      service: 'iot-gateway',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
    });
  });

  // Public Readiness Endpoint (preserves existing contract and status enums)
  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await getReadinessData();
    return reply.status(data.statusCode).send({
      status: data.overallStatus,
      service: 'iot-gateway',
      timestamp: new Date().toISOString(),
      mqtt: {
        status: data.mqttStatus,
        connected: data.isMqttConnected,
      },
      database: {
        status: data.dbStatus,
        connected: data.isDbConnected,
      },
    });
  });

  const verifyInternalAuth = (request: FastifyRequest, reply: FastifyReply): boolean => {
    const expectedToken = env?.INTERNAL_SERVICE_TOKEN;
    if (!expectedToken || expectedToken.trim().length === 0) {
      reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_NOT_CONFIGURED',
          message: 'Internal service authentication is not configured.',
        },
      });
      return false;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header for internal endpoint.',
        },
      });
      return false;
    }

    const token = authHeader.slice(7).trim();
    if (token !== expectedToken) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid internal service token.',
        },
      });
      return false;
    }

    return true;
  };

  // Internal Liveness Endpoint per API.md §23.2
  app.get('/internal/v1/health', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyInternalAuth(request, reply)) {
      return;
    }

    return reply.status(200).send({
      status: 'ok',
    });
  });

  // Internal Readiness Endpoint per API.md §23.3 and DEC-INF-078
  app.get('/internal/v1/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyInternalAuth(request, reply)) {
      return;
    }

    const data = await getReadinessData();
    return reply.status(data.statusCode).send({
      status: data.canonicalStatus,
      dependencies: {
        database: data.isDbConnected ? 'up' : 'down',
        broker: data.isMqttConnected ? 'up' : 'down',
      },
    });
  });
}
