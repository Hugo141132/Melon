import Fastify, { FastifyInstance } from 'fastify';
import { GatewayEnv } from './config/env';
import { GatewayMqttClient } from './mqtt/client';
import {
  CommandPublisher,
  commandPublisher as defaultCommandPublisher,
} from './commands/publisher';
import { registerHealthRoutes, DbChecker } from './routes/health';
import { logger } from './observability/logger';

export interface AppOptions {
  env: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  dbChecker?: DbChecker;
  commandPublisher?: CommandPublisher;
}

export function buildApp(options: AppOptions): {
  app: FastifyInstance;
  mqttClient: GatewayMqttClient;
  commandPublisher: CommandPublisher;
} {
  const app = Fastify({
    logger: false, // We use our structured logger module with secret redaction
  });

  const mqttClient = options.mqttClient ?? new GatewayMqttClient(options.env);
  const commandPublisher = options.commandPublisher ?? defaultCommandPublisher;
  commandPublisher.bind(options.env, mqttClient);

  // Register routes
  registerHealthRoutes(app, mqttClient, options.dbChecker);

  // Global error handler with secret redaction
  app.setErrorHandler((error, _request, reply) => {
    logger.error('Unhandled Fastify request error', error);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred in the gateway service.',
      },
    });
  });

  return { app, mqttClient, commandPublisher };
}
