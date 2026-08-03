import { validateGatewayEnv, redactSecrets } from './config/env';
import { buildApp } from './app';
import { logger } from './observability/logger';

async function startServer() {
  try {
    const env = validateGatewayEnv(process.env);

    logger.info('Starting IoT Gateway Service...', {
      NODE_ENV: env.NODE_ENV,
      APP_ENV: env.APP_ENV,
      PORT: env.PORT,
      HOST: env.HOST,
      sanitizedConfig: redactSecrets({
        MQTT_BROKER_URL: env.MQTT_BROKER_URL,
        MQTT_GATEWAY_CLIENT_ID: env.MQTT_GATEWAY_CLIENT_ID,
        MQTT_GATEWAY_USERNAME: env.MQTT_GATEWAY_USERNAME,
        ENABLE_FAUCET_CONTROL: env.ENABLE_FAUCET_CONTROL,
      }),
    });

    const { app, mqttClient, commandPublisher, acknowledgementProcessor, faucetEventProcessor } =
      buildApp({ env });

    // Connect to MQTT Broker asynchronously (non-blocking server start)
    if (env.MQTT_BROKER_URL) {
      mqttClient
        .connect()
        .then(() => {
          acknowledgementProcessor.subscribeToAcknowledgements().catch((err) => {
            logger.error('Failed to subscribe to ACKs after MQTT connection', err);
          });
          faucetEventProcessor.subscribeToEvents().catch((err) => {
            logger.error('Failed to subscribe to events after MQTT connection', err);
          });
        })
        .catch((err) => {
          logger.warn('Initial MQTT connection attempt failed, will auto-retry', {
            error: err.message,
          });
        });
    } else {
      logger.warn('MQTT_BROKER_URL not configured. Running gateway in HTTP-only standby mode.');
    }

    // Start command publisher polling worker if DB and MQTT are configured
    if (env.DATABASE_URL && env.MQTT_BROKER_URL) {
      commandPublisher.startPolling(2000);
    }

    // Start Fastify HTTP server
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`IoT Gateway HTTP server listening at ${address}`);

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down IoT Gateway Service gracefully...`);
      try {
        commandPublisher.stopPolling();
        acknowledgementProcessor.stop();
        faucetEventProcessor.stop();
        await app.close();
        await mqttClient.disconnect();
        logger.info('IoT Gateway Service shutdown complete.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during IoT Gateway shutdown', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    logger.error('Fatal startup error in IoT Gateway Service', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
