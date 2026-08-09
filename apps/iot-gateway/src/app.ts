import Fastify, { FastifyInstance, FastifyError } from 'fastify';
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
import {
  TelemetryProcessor,
  telemetryProcessor as defaultTelemetryProcessor,
} from './telemetry/processor';
import { registerHealthRoutes, DbChecker } from './routes/health';
import { logger } from './observability/logger';

export interface AppOptions {
  env: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  dbChecker?: DbChecker;
  commandPublisher?: CommandPublisher;
  acknowledgementProcessor?: AcknowledgementProcessor;
  faucetEventProcessor?: FaucetEventProcessor;
  telemetryProcessor?: TelemetryProcessor;
}

// In-memory rate limit store for gateway HTTP endpoints
const gatewayRateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function clearGatewayRateLimitStore(): void {
  gatewayRateLimitStore.clear();
}

function checkGatewayRateLimit(
  ip: string,
  limit: number,
  windowMs: number
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const key = `gateway:${ip}`;
  let entry = gatewayRateLimitStore.get(key);

  if (!entry || now >= entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    gatewayRateLimitStore.set(key, entry);
  } else {
    entry.count += 1;
  }

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfterMs = Math.max(0, entry.resetTime - now);
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  return {
    allowed,
    limit,
    remaining,
    resetTime: entry.resetTime,
    retryAfterSeconds,
  };
}

export function buildApp(options: AppOptions): {
  app: FastifyInstance;
  mqttClient: GatewayMqttClient;
  commandPublisher: CommandPublisher;
  acknowledgementProcessor: AcknowledgementProcessor;
  faucetEventProcessor: FaucetEventProcessor;
  telemetryProcessor: TelemetryProcessor;
} {
  const app = Fastify({
    logger: false, // We use our structured logger module with secret redaction
  });

  const mqttClient = options.mqttClient ?? new GatewayMqttClient(options.env);
  const commandPublisher = options.commandPublisher ?? defaultCommandPublisher;
  const acknowledgementProcessor =
    options.acknowledgementProcessor ?? defaultAcknowledgementProcessor;
  const faucetEventProcessor = options.faucetEventProcessor ?? defaultFaucetEventProcessor;
  const telemetryProcessor = options.telemetryProcessor ?? defaultTelemetryProcessor;

  commandPublisher.bind(options.env, mqttClient);
  acknowledgementProcessor.bind(options.env, mqttClient);
  faucetEventProcessor.bind(options.env, mqttClient);
  telemetryProcessor.bind(options.env, mqttClient);

  // Security headers and rate limiting hook per SECURITY.md §16.4, §16.8 and TASK-0902
  app.addHook('onRequest', async (request, reply) => {
    // GHSA-jx2c-rxcm-jvmq workaround: Reject headers containing tab characters (\t / 0x09)
    for (const [headerName, headerValue] of Object.entries(request.headers)) {
      const valStr = Array.isArray(headerValue) ? headerValue.join('') : headerValue || '';
      if (valStr.includes('\t')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_HEADER',
            message: `Header '${headerName}' contains invalid tab character.`,
          },
        });
      }
    }

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

    const clientIp = request.ip || '127.0.0.1';
    const rateLimit = checkGatewayRateLimit(
      clientIp,
      options.env.RATE_LIMIT_GATEWAY_MAX ?? 60,
      options.env.RATE_LIMIT_WINDOW_MS ?? 60000
    );

    reply.header('X-RateLimit-Limit', String(rateLimit.limit));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, rateLimit.remaining)));
    reply.header('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));

    if (!rateLimit.allowed) {
      reply.header('Retry-After', String(Math.max(1, rateLimit.retryAfterSeconds)));
      return reply.status(429).send({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests to gateway service. Please try again later.',
        },
      });
    }
  });

  // Register routes
  registerHealthRoutes(app, mqttClient, options.dbChecker);

  // Global error handler with secret redaction (typed for Fastify v5)
  app.setErrorHandler((error: FastifyError | Error | unknown, _request, reply) => {
    logger.error('Unhandled Fastify request error', error);
    const statusCode = (error as { statusCode?: number })?.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred in the gateway service.',
      },
    });
  });

  return {
    app,
    mqttClient,
    commandPublisher,
    acknowledgementProcessor,
    faucetEventProcessor,
    telemetryProcessor,
  };
}
