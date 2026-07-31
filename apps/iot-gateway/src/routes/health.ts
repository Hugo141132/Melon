import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@kebun-melon/database';
import { GatewayMqttClient } from '../mqtt/client';

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
  dbChecker: DbChecker = defaultDbChecker
): void {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'pass',
      service: 'iot-gateway',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
    });
  });

  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const mqttStatus = mqttClient.getStatus();
    const isMqttConnected = mqttClient.isConnected();
    const isDbConnected = await dbChecker();

    const dbStatus = isDbConnected ? 'CONNECTED' : 'DISCONNECTED';

    let overallStatus: 'UP' | 'DEGRADED' | 'DOWN';
    let statusCode: number;

    if (!isDbConnected) {
      overallStatus = 'DOWN';
      statusCode = 503;
    } else if (isMqttConnected) {
      overallStatus = 'UP';
      statusCode = 200;
    } else {
      overallStatus = 'DEGRADED';
      statusCode = 503;
    }

    return reply.status(statusCode).send({
      status: overallStatus,
      service: 'iot-gateway',
      timestamp: new Date().toISOString(),
      mqtt: {
        status: mqttStatus,
        connected: isMqttConnected,
      },
      database: {
        status: dbStatus,
        connected: isDbConnected,
      },
    });
  });
}
