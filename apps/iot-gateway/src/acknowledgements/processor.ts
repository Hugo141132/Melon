import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  FaucetCommandRepository,
  DeviceRepository,
  AlertRepository,
} from '@kebun-melon/database';
import {
  FaucetCommandStatus,
  FaucetCommandAction,
  DeviceType,
  FaucetAcknowledgementPayloadSchema,
  FaucetAcknowledgementPayload,
} from '@kebun-melon/contracts';
import { GatewayMqttClient } from '../mqtt/client';
import { GatewayEnv } from '../config/env';
import { mqttTopicRouter } from '../mqtt/router';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';

export interface AcknowledgementProcessorOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  prisma?: PrismaClient;
  faucetCommandRepo?: FaucetCommandRepository;
  deviceRepo?: DeviceRepository;
  alertRepo?: AlertRepository;
}

export class AcknowledgementProcessor {
  private prisma: PrismaClient | null;
  private faucetCommandRepo: FaucetCommandRepository | null;
  private deviceRepo: DeviceRepository | null;
  private alertRepo: AlertRepository | null;
  private mqttClient: GatewayMqttClient | null;
  private env: GatewayEnv | null;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;

  constructor(options: AcknowledgementProcessorOptions = {}) {
    this.env = options.env || null;
    this.mqttClient = options.mqttClient || null;
    this.prisma = options.prisma ?? defaultPrisma;
    this.faucetCommandRepo =
      options.faucetCommandRepo ?? (this.prisma ? new FaucetCommandRepository(this.prisma) : null);
    this.deviceRepo =
      options.deviceRepo ?? (this.prisma ? new DeviceRepository(this.prisma) : null);
    this.alertRepo = options.alertRepo ?? (this.prisma ? new AlertRepository(this.prisma) : null);
  }

  /**
   * Binds gateway environment and MQTT client if not provided in constructor.
   */
  public bind(env: GatewayEnv, mqttClient: GatewayMqttClient): void {
    this.env = env;
    this.mqttClient = mqttClient;
  }

  /**
   * Subscribes to canonical faucet ACK topic patterns and registers message listener.
   */
  public async subscribeToAcknowledgements(): Promise<void> {
    if (!this.mqttClient || !this.env) {
      logger.warn('Cannot subscribe to acknowledgements: MQTT client or env not bound');
      return;
    }

    if (this.isSubscribed) return;

    const topicPattern = mqttTopicRouter.getCategorySubscriptionPattern(
      this.env.APP_ENV,
      'ack',
      'faucet'
    );

    try {
      await this.mqttClient.subscribe(topicPattern);
      this.unsubscribeFn = this.mqttClient.onMessage((topic, payload) => {
        this.processAcknowledgementMessage(topic, payload).catch((err) => {
          logger.error('Unhandled error processing faucet acknowledgement message', err, {
            topic,
          });
        });
      });
      this.isSubscribed = true;
      logger.info('AcknowledgementProcessor subscribed to faucet ACK topics', { topicPattern });
    } catch (err) {
      logger.error('Failed to subscribe to faucet acknowledgement topics', err, { topicPattern });
    }
  }

  /**
   * Stops processing and unsubscribes message handler.
   */
  public stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.isSubscribed = false;
  }

  /**
   * Scaffold & legacy compatibility method for handling device command acknowledgements.
   */
  public async processAcknowledgement(
    deviceId: string,
    commandId: string,
    status: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.debug('AcknowledgementProcessor received direct ACK call', {
      deviceId,
      commandId,
      status,
      metadata,
    });
  }

  /**
   * Main entry point for processing incoming faucet ACK MQTT messages.
   */
  public async processAcknowledgementMessage(
    topic: string,
    rawPayload: Buffer
  ): Promise<{ success: boolean; reason?: string }> {
    const expectedEnv = this.env?.APP_ENV || 'development';

    // 1. Topic validation
    const topicValidation = mqttTopicRouter.validateTopic(topic, expectedEnv);
    if (!topicValidation.valid || !topicValidation.parsed) {
      return { success: false, reason: `Invalid topic: ${topicValidation.error}` };
    }

    const parsedTopic = topicValidation.parsed;
    if (parsedTopic.category !== 'ack' || parsedTopic.subtype !== 'faucet') {
      return { success: false, reason: 'Topic is not a faucet acknowledgement topic' };
    }

    // 2. Parse JSON payload
    let jsonPayload: unknown;
    try {
      jsonPayload = JSON.parse(rawPayload.toString('utf-8'));
    } catch (err) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Failed to parse faucet ACK message JSON payload', { topic });
      return { success: false, reason: 'Invalid JSON payload' };
    }

    // 3. Schema validation
    const schemaValidation = FaucetAcknowledgementPayloadSchema.safeParse(jsonPayload);
    if (!schemaValidation.success) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Faucet ACK payload failed Zod schema validation', {
        topic,
        errors: schemaValidation.error.errors,
      });
      return { success: false, reason: 'Payload schema validation failed' };
    }

    const payload: FaucetAcknowledgementPayload = schemaValidation.data;

    // 4. Topic deviceId vs Payload deviceId matching
    if (parsedTopic.deviceId !== payload.deviceId) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Topic deviceId mismatch with payload deviceId in faucet ACK', {
        topicDeviceId: parsedTopic.deviceId,
        payloadDeviceId: payload.deviceId,
        topic,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Topic and payload deviceId mismatch' };
    }

    if (!this.faucetCommandRepo || !this.deviceRepo) {
      logger.warn('Database repositories unavailable for ACK processing');
      return { success: false, reason: 'Database repositories unavailable' };
    }

    // 5. Resolve external payload.deviceId to Device record
    const device = await this.deviceRepo.getDeviceByCanonicalId(payload.deviceId);
    if (!device) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Target device for faucet ACK not found in database', {
        deviceId: payload.deviceId,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Device not found' };
    }

    // 6. Enforce WATER_TANK_NODE device type scope
    if (device.deviceType !== DeviceType.WATER_TANK_NODE) {
      logger.warn('Received faucet ACK for device that is not a WATER_TANK_NODE', {
        deviceId: payload.deviceId,
        deviceType: device.deviceType,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Device is not a WATER_TANK_NODE' };
    }

    // 7. Lookup target FaucetCommand and compare command.deviceId with resolved Device.id
    const command = await this.faucetCommandRepo.getCommandById(payload.commandId);
    if (!command) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Received faucet ACK for unknown commandId', {
        commandId: payload.commandId,
        deviceId: payload.deviceId,
        topic,
      });
      return { success: false, reason: 'Unknown commandId' };
    }

    if (command.deviceId !== device.id && command.deviceId !== device.deviceId) {
      logger.warn('Command target deviceId mismatch with resolved device record', {
        commandDeviceId: command.deviceId,
        resolvedDeviceId: device.id,
        canonicalDeviceId: device.deviceId,
        payloadDeviceId: payload.deviceId,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Command target deviceId mismatch' };
    }

    // 8. Validate persisted command action (must be DISPENSE, OPEN, or CLOSE)
    const validActions: FaucetCommandAction[] = [
      FaucetCommandAction.DISPENSE,
      FaucetCommandAction.OPEN,
      FaucetCommandAction.CLOSE,
    ];
    if (!validActions.includes(command.action)) {
      logger.warn('Received faucet ACK for command with unsupported or invalid action', {
        commandId: command.commandId,
        action: command.action,
        deviceId: payload.deviceId,
      });
      return {
        success: false,
        reason: `Unsupported or invalid command action '${command.action}'`,
      };
    }

    // 9. Duplicate messageId check (Idempotency)
    if (payload.messageId && command.events) {
      const existingEvent = command.events.find((e) => e.messageId === payload.messageId);
      if (existingEvent) {
        logger.info('Duplicate messageId received in faucet ACK, handled idempotently', {
          messageId: payload.messageId,
          commandId: payload.commandId,
        });
        return { success: true, reason: 'Duplicate messageId handled idempotently' };
      }
    }

    // 10. Execute state transition and event persistence
    const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : undefined;
    const isAccepted = payload.data.accepted && payload.data.status === 'ACKNOWLEDGED';

    if (isAccepted) {
      // Accepted ACK: SENT -> ACKNOWLEDGED only
      if (command.status === FaucetCommandStatus.SENT) {
        await this.faucetCommandRepo.updateCommandStatus(
          command.commandId,
          FaucetCommandStatus.ACKNOWLEDGED,
          {
            messageId: payload.messageId,
            recordedAt,
            metadata: { ackData: payload.data },
          }
        );
        metricsCollector.incrementAcknowledgements();
        logger.info('Faucet command successfully ACKNOWLEDGED by device', {
          commandId: command.commandId,
          deviceId: command.deviceId,
          messageId: payload.messageId,
        });
        return { success: true };
      } else {
        // ACKs for QUEUED, ACKNOWLEDGED, IN_PROGRESS, or final states must be ignored/logged without regression
        logger.info('Ignored accepted ACK: command is not in SENT status', {
          commandId: command.commandId,
          currentStatus: command.status,
          messageId: payload.messageId,
        });
        return {
          success: true,
          reason: `Accepted ACK ignored because command status is '${command.status}', expected 'SENT'`,
        };
      }
    } else {
      // Rejected ACK: SENT -> FAILED only
      const reasonCode = payload.data.reasonCode || 'REJECTED_BY_DEVICE';

      if (command.status === FaucetCommandStatus.SENT) {
        await this.faucetCommandRepo.updateCommandStatus(
          command.commandId,
          FaucetCommandStatus.FAILED,
          {
            messageId: payload.messageId,
            reasonCode,
            recordedAt,
            metadata: { ackData: payload.data },
          }
        );
        metricsCollector.incrementCommandFailures();
        logger.warn('Faucet command REJECTED by device', {
          commandId: command.commandId,
          deviceId: command.deviceId,
          reasonCode,
          messageId: payload.messageId,
        });

        if (this.alertRepo) {
          try {
            await this.alertRepo.createCommandFailureAlert({
              deviceId: device.id,
              commandId: command.id,
              reasonCode,
              openedAt: recordedAt,
              metadata: {
                source: 'ACKNOWLEDGEMENT_REJECTION',
                messageId: payload.messageId,
                ackData: payload.data,
              },
            });
          } catch (alertErr) {
            logger.error('Failed to create command failure alert on rejected ACK', alertErr, {
              commandId: command.commandId,
              deviceId: device.id,
            });
          }
        }

        return { success: true };
      } else {
        // ACKs for QUEUED, ACKNOWLEDGED, IN_PROGRESS, or final states must be ignored/logged without regression
        logger.info('Ignored rejected ACK: command is not in SENT status', {
          commandId: command.commandId,
          currentStatus: command.status,
          messageId: payload.messageId,
        });
        return {
          success: true,
          reason: `Rejected ACK ignored because command status is '${command.status}', expected 'SENT'`,
        };
      }
    }
  }
}

export const acknowledgementProcessor = new AcknowledgementProcessor();
