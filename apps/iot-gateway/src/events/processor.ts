import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  FaucetCommandRepository,
  DeviceRepository,
  AlertRepository,
  InvalidCommandStateTransitionError,
} from '@kebun-melon/database';
import {
  FaucetCommandStatus,
  FaucetCommandAction,
  DeviceType,
  FaucetEventPayloadSchema,
  FaucetEventPayload,
} from '@kebun-melon/contracts';
import { GatewayMqttClient } from '../mqtt/client';
import { GatewayEnv } from '../config/env';
import { mqttTopicRouter } from '../mqtt/router';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';
import { publishRealtimeEvent } from './webhook';

export type AuthoritativePhysicalFaucetState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/**
 * Determines authoritative physical faucet state per TASK-0806:
 * - COMPLETED OPEN -> 'OPEN'
 * - COMPLETED CLOSE -> 'CLOSED'
 * - COMPLETED DISPENSE -> 'UNKNOWN' (unless approved device contract explicitly confirms physical state)
 * - failed/uncertain execution -> 'UNKNOWN'
 * - Never infer physical state from API acceptance, MQTT publication, or ACK.
 */
export function determinePhysicalFaucetState(
  action: string,
  eventStatus: string
): AuthoritativePhysicalFaucetState {
  if (eventStatus === 'COMPLETED') {
    if (action === FaucetCommandAction.OPEN || action === 'OPEN') {
      return 'OPEN';
    }
    if (action === FaucetCommandAction.CLOSE || action === 'CLOSE') {
      return 'CLOSED';
    }
    // DISPENSE completion does NOT infer CLOSED or OPEN per TASK-0806 correction
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

export interface FaucetEventProcessorOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  prisma?: PrismaClient;
  faucetCommandRepo?: FaucetCommandRepository;
  deviceRepo?: DeviceRepository;
  alertRepo?: AlertRepository;
}

export class FaucetEventProcessor {
  private prisma: PrismaClient | null;
  private faucetCommandRepo: FaucetCommandRepository | null;
  private deviceRepo: DeviceRepository | null;
  private alertRepo: AlertRepository | null;
  private mqttClient: GatewayMqttClient | null;
  private env: GatewayEnv | null;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;

  constructor(options: FaucetEventProcessorOptions = {}) {
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
   * Subscribes to canonical faucet event topic patterns (`event/faucet`) and registers message listener.
   */
  public async subscribeToEvents(): Promise<void> {
    if (!this.mqttClient || !this.env) {
      logger.warn('Cannot subscribe to events: MQTT client or env not bound');
      return;
    }

    if (this.isSubscribed) return;

    const topicPattern = mqttTopicRouter.getCategorySubscriptionPattern(
      this.env.APP_ENV,
      'event',
      'faucet'
    );

    try {
      await this.mqttClient.subscribe(topicPattern);
      this.unsubscribeFn = this.mqttClient.onMessage((topic, payload) => {
        this.processEventMessage(topic, payload).catch((err) => {
          logger.error('Unhandled error processing faucet event message', err, {
            topic,
          });
        });
      });
      this.isSubscribed = true;
      logger.info('FaucetEventProcessor subscribed to faucet event topics', { topicPattern });
    } catch (err) {
      logger.error('Failed to subscribe to faucet event topics', err, { topicPattern });
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
   * Main entry point for processing incoming faucet execution event MQTT messages.
   */
  public async processEventMessage(
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
    if (parsedTopic.category !== 'event' || parsedTopic.subtype !== 'faucet') {
      return { success: false, reason: 'Topic is not a faucet event topic' };
    }

    // 2. Parse JSON payload
    let jsonPayload: unknown;
    try {
      jsonPayload = JSON.parse(rawPayload.toString('utf-8'));
    } catch (err) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Failed to parse faucet event message JSON payload', { topic });
      return { success: false, reason: 'Invalid JSON payload' };
    }

    // 3. Schema validation
    const schemaValidation = FaucetEventPayloadSchema.safeParse(jsonPayload);
    if (!schemaValidation.success) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Faucet event payload failed Zod schema validation', {
        topic,
        errors: schemaValidation.error.errors,
      });
      return { success: false, reason: 'Payload schema validation failed' };
    }

    const payload: FaucetEventPayload = schemaValidation.data;

    // 4. Topic deviceId vs Payload deviceId matching
    if (parsedTopic.deviceId !== payload.deviceId) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Topic deviceId mismatch with payload deviceId in faucet event', {
        topicDeviceId: parsedTopic.deviceId,
        payloadDeviceId: payload.deviceId,
        topic,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Topic and payload deviceId mismatch' };
    }

    if (!this.faucetCommandRepo || !this.deviceRepo) {
      logger.warn('Database repositories unavailable for event processing');
      return { success: false, reason: 'Database repositories unavailable' };
    }

    // 5. Resolve external payload.deviceId to Device record
    const device = await this.deviceRepo.getDeviceByCanonicalId(payload.deviceId);
    if (!device) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Target device for faucet event not found in database', {
        deviceId: payload.deviceId,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Device not found' };
    }

    // 6. Enforce WATER_TANK_NODE device type scope
    if (device.deviceType !== DeviceType.WATER_TANK_NODE) {
      logger.warn('Received faucet event for device that is not a WATER_TANK_NODE', {
        deviceId: payload.deviceId,
        deviceType: device.deviceType,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Device is not a WATER_TANK_NODE' };
    }

    // 7. Enforce topic siteId matches resolved device siteId
    if (device.siteId !== parsedTopic.siteId) {
      logger.warn('Topic siteId mismatch with resolved device siteId', {
        topicSiteId: parsedTopic.siteId,
        deviceSiteId: device.siteId,
        deviceId: payload.deviceId,
        commandId: payload.commandId,
      });
      return { success: false, reason: 'Topic siteId mismatch with device site' };
    }

    // 8. Lookup target FaucetCommand and compare command.deviceId with resolved Device.id
    const command = await this.faucetCommandRepo.getCommandById(payload.commandId);
    if (!command) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Received faucet event for unknown commandId', {
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

    // Validate persisted action
    const validActions: string[] = [
      FaucetCommandAction.DISPENSE,
      FaucetCommandAction.OPEN,
      FaucetCommandAction.CLOSE,
    ];
    if (!validActions.includes(command.action)) {
      logger.warn('Command has invalid or unsupported action', {
        commandId: command.commandId,
        action: command.action,
      });
      return { success: false, reason: 'Invalid or unsupported command action' };
    }

    // 9. Duplicate messageId check (Idempotency)
    if (payload.messageId && command.events) {
      const existingEvent = command.events.find((e) => e.messageId === payload.messageId);
      if (existingEvent) {
        logger.info('Duplicate messageId received in faucet event, handled idempotently', {
          messageId: payload.messageId,
          commandId: payload.commandId,
        });
        return { success: true, reason: 'Duplicate messageId handled idempotently' };
      }
    }

    // 10. Execute state transition and event persistence
    const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : undefined;
    const eventStatusStr = payload.data.status;

    // Terminal states cannot regress or be modified by subsequent events
    const terminalStatuses: FaucetCommandStatus[] = [
      FaucetCommandStatus.COMPLETED,
      FaucetCommandStatus.FAILED,
      FaucetCommandStatus.CANCELLED,
      FaucetCommandStatus.TIMEOUT,
      FaucetCommandStatus.EXPIRED,
    ];

    if (terminalStatuses.includes(command.status)) {
      logger.info('Ignored faucet event: command is already in a terminal state', {
        commandId: command.commandId,
        currentStatus: command.status,
        incomingEventStatus: eventStatusStr,
        messageId: payload.messageId,
      });
      return {
        success: true,
        reason: `Event '${eventStatusStr}' ignored because command is already in terminal state '${command.status}'`,
      };
    }

    if (eventStatusStr === 'IN_PROGRESS') {
      const isDispense = command.action === FaucetCommandAction.DISPENSE;
      const actualVolumeMl = isDispense ? payload.data.actualVolumeMl : undefined;

      try {
        if (command.status === FaucetCommandStatus.ACKNOWLEDGED) {
          await this.faucetCommandRepo.updateCommandStatus(
            command.commandId,
            FaucetCommandStatus.IN_PROGRESS,
            {
              messageId: payload.messageId,
              recordedAt,
              actualVolumeMl,
              metadata: {
                eventData: payload.data,
                physicalState: 'UNKNOWN',
                action: command.action,
              },
            }
          );
          logger.info('Faucet command state updated to IN_PROGRESS', {
            commandId: command.commandId,
            deviceId: command.deviceId,
            action: command.action,
            messageId: payload.messageId,
          });

          await publishRealtimeEvent(
            this.env,
            'faucet.command.updated',
            {
              commandId: command.commandId,
              status: FaucetCommandStatus.IN_PROGRESS,
              actualVolumeMl,
            },
            device.deviceId
          );

          return { success: true };
        } else if (command.status === FaucetCommandStatus.IN_PROGRESS) {
          // Append progress event log idempotently without failing
          await this.faucetCommandRepo.addCommandEvent(command.commandId, {
            eventStatus: FaucetCommandStatus.IN_PROGRESS,
            messageId: payload.messageId,
            actualVolumeMl,
            recordedAt,
            metadata: {
              eventData: payload.data,
              physicalState: 'UNKNOWN',
              action: command.action,
            },
          });
          logger.info('Appended progress event for command already IN_PROGRESS', {
            commandId: command.commandId,
            action: command.action,
            messageId: payload.messageId,
          });

          await publishRealtimeEvent(
            this.env,
            'faucet.command.updated',
            {
              commandId: command.commandId,
              status: FaucetCommandStatus.IN_PROGRESS,
              actualVolumeMl,
            },
            device.deviceId
          );

          return { success: true };
        } else {
          logger.warn('Ignored IN_PROGRESS event: invalid initial command status', {
            commandId: command.commandId,
            currentStatus: command.status,
          });
          return {
            success: true,
            reason: `IN_PROGRESS event ignored because command status is '${command.status}'`,
          };
        }
      } catch (err: any) {
        if (err instanceof InvalidCommandStateTransitionError) {
          logger.info('Ignored IN_PROGRESS event: command already reached terminal status', {
            commandId: command.commandId,
            error: err.message,
          });
          return {
            success: true,
            reason: `IN_PROGRESS event ignored because command has reached a terminal state`,
          };
        }
        throw err;
      }
    } else if (eventStatusStr === 'COMPLETED') {
      // Action-specific volume validation
      if (command.action === FaucetCommandAction.DISPENSE) {
        if (
          payload.data.targetVolumeMl !== undefined &&
          payload.data.targetVolumeMl !== command.targetVolumeMl
        ) {
          logger.warn('COMPLETED event targetVolumeMl mismatch', {
            commandId: command.commandId,
            eventTargetVolumeMl: payload.data.targetVolumeMl,
            commandTargetVolumeMl: command.targetVolumeMl,
          });
          return {
            success: false,
            reason: 'Target volume mismatch in COMPLETED event',
          };
        }

        if (
          payload.data.actualVolumeMl !== undefined &&
          payload.data.actualVolumeMl !== null &&
          payload.data.actualVolumeMl < 0
        ) {
          logger.warn('COMPLETED event negative actualVolumeMl', {
            commandId: command.commandId,
            actualVolumeMl: payload.data.actualVolumeMl,
          });
          return {
            success: false,
            reason: 'COMPLETED event requires valid non-negative actualVolumeMl',
          };
        }
      }

      if (command.status === FaucetCommandStatus.IN_PROGRESS) {
        const physicalState = determinePhysicalFaucetState(command.action, 'COMPLETED');
        const isDispense = command.action === FaucetCommandAction.DISPENSE;
        const actualVolumeMl = isDispense ? payload.data.actualVolumeMl : undefined;

        await this.faucetCommandRepo.updateCommandStatus(
          command.commandId,
          FaucetCommandStatus.COMPLETED,
          {
            messageId: payload.messageId,
            recordedAt,
            actualVolumeMl,
            metadata: {
              eventData: payload.data,
              physicalState,
              action: command.action,
            },
          }
        );
        logger.info('Faucet command successfully COMPLETED', {
          commandId: command.commandId,
          deviceId: command.deviceId,
          action: command.action,
          physicalState,
          actualVolumeMl,
          messageId: payload.messageId,
        });

        await publishRealtimeEvent(
          this.env,
          'faucet.command.updated',
          {
            commandId: command.commandId,
            status: FaucetCommandStatus.COMPLETED,
            actualVolumeMl,
          },
          device.deviceId
        );

        return { success: true };
      } else {
        logger.warn('Ignored COMPLETED event: invalid initial command status', {
          commandId: command.commandId,
          currentStatus: command.status,
        });
        return {
          success: true,
          reason: `COMPLETED event ignored because command status is '${command.status}'`,
        };
      }
    } else if (eventStatusStr === 'FAILED') {
      const reasonCode = payload.data.reasonCode || 'EXECUTION_FAILED';
      const isDispense = command.action === FaucetCommandAction.DISPENSE;
      const actualVolumeMl = isDispense ? payload.data.actualVolumeMl : undefined;

      if (
        command.status === FaucetCommandStatus.ACKNOWLEDGED ||
        command.status === FaucetCommandStatus.IN_PROGRESS
      ) {
        await this.faucetCommandRepo.updateCommandStatus(
          command.commandId,
          FaucetCommandStatus.FAILED,
          {
            messageId: payload.messageId,
            reasonCode,
            recordedAt,
            actualVolumeMl,
            metadata: {
              eventData: payload.data,
              physicalState: 'UNKNOWN',
              action: command.action,
            },
          }
        );
        metricsCollector.incrementCommandFailures();
        logger.warn('Faucet command execution FAILED', {
          commandId: command.commandId,
          deviceId: command.deviceId,
          action: command.action,
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
                source: 'EXECUTION_EVENT_FAILURE',
                messageId: payload.messageId,
                eventData: payload.data,
                physicalOutcome: 'UNKNOWN',
                action: command.action,
              },
            });
          } catch (alertErr) {
            logger.error('Failed to create command failure alert on FAILED event', alertErr, {
              commandId: command.commandId,
              deviceId: device.id,
            });
          }
        }

        await publishRealtimeEvent(
          this.env,
          'faucet.command.updated',
          {
            commandId: command.commandId,
            status: FaucetCommandStatus.FAILED,
            reasonCode,
            actualVolumeMl,
          },
          device.deviceId
        );

        return { success: true };
      } else {
        logger.warn('Ignored FAILED event: invalid initial command status', {
          commandId: command.commandId,
          currentStatus: command.status,
        });
        return {
          success: true,
          reason: `FAILED event ignored because command status is '${command.status}'`,
        };
      }
    }

    return { success: false, reason: `Unhandled event status '${eventStatusStr}'` };
  }
}

export const faucetEventProcessor = new FaucetEventProcessor();
