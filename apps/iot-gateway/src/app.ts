import Fastify, { FastifyInstance } from 'fastify';
import { GatewayEnv } from './config/env';
import { GatewayMqttClient } from './mqtt/client';
import {
  CommandPublisher,
  commandPublisher as defaultCommandPublisher,
} from './commands/publisher';
import {
  AcknowledgementProcessor,
  acknowledgementProcessor as defaultAcknowledgementProcessor,
} from './acknowledgements/processor';
import {
  FaucetEventProcessor,
  faucetEventProcessor as defaultFaucetEventProcessor,
} from './events/processor';
import { registerHealthRoutes, DbChecker } from './routes/health';
import { logger } from './observability/logger';

export interface AppOptions {
  env: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  dbChecker?: DbChecker;
  commandPublisher?: CommandPublisher;
  acknowledgementProcessor?: AcknowledgementProcessor;
  faucetEventProcessor?: FaucetEventProcessor;
}

export function buildApp(options: AppOptions): {
  app: FastifyInstance;
  mqttClient: GatewayMqttClient;
  commandPublisher: CommandPublisher;
  acknowledgementProcessor: AcknowledgementProcessor;
  faucetEventProcessor: FaucetEventProcessor;
} {
  const app = Fastify({
    logger: false, // We use our structured logger module with secret redaction
  });

  const mqttClient = options.mqttClient ?? new GatewayMqttClient(options.env);
  const commandPublisher = options.commandPublisher ?? defaultCommandPublisher;
  const acknowledgementProcessor =
    options.acknowledgementProcessor ?? defaultAcknowledgementProcessor;
  const faucetEventProcessor = options.faucetEventProcessor ?? defaultFaucetEventProcessor;

  commandPublisher.bind(options.env, mqttClient);
  acknowledgementProcessor.bind(options.env, mqttClient);
  faucetEventProcessor.bind(options.env, mqttClient);

  // Security headers hook per SECURITY.md §16.8 and TASK-0901
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
    );

    const isProd = options.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (isProd) {
      reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
  });

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

  return { app, mqttClient, commandPublisher, acknowledgementProcessor, faucetEventProcessor };
}
