import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  FaucetCommandRepository,
  DeviceRepository,
} from '@kebun-melon/database';
import {
  FaucetCommandStatus,
  DeviceType,
  DeviceAccountStatus,
  mapPhaseToVolume,
  FaucetCommandAction,
} from '@kebun-melon/contracts';
import { GatewayMqttClient } from '../mqtt/client';
import { GatewayEnv } from '../config/env';
import { mqttTopicRouter, AllowedEnvironment } from '../mqtt/router';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';

export interface CommandPublisherOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  prisma?: PrismaClient;
  faucetCommandRepo?: FaucetCommandRepository;
  deviceRepo?: DeviceRepository;
}

export interface PublishResult {
  publishedCount: number;
  expiredCount: number;
  failedCount: number;
  skippedCount: number;
}

export class CommandPublisher {
  private prisma: PrismaClient | null;
  private faucetCommandRepo: FaucetCommandRepository | null;
  private deviceRepo: DeviceRepository | null;
  private mqttClient: GatewayMqttClient | null;
  private env: GatewayEnv | null;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(options: CommandPublisherOptions = {}) {
    this.env = options.env || null;
    this.mqttClient = options.mqttClient || null;
    this.prisma = options.prisma ?? defaultPrisma;
    this.faucetCommandRepo =
      options.faucetCommandRepo ?? (this.prisma ? new FaucetCommandRepository(this.prisma) : null);
    this.deviceRepo =
      options.deviceRepo ?? (this.prisma ? new DeviceRepository(this.prisma) : null);
  }

  /**
   * Binds gateway environment and MQTT client if not provided during constructor.
   */
  public bind(env: GatewayEnv, mqttClient: GatewayMqttClient): void {
    this.env = env;
    this.mqttClient = mqttClient;
  }

  /**
   * Starts periodic polling worker for queued faucet commands.
   */
  public startPolling(intervalMs = 2000): void {
    if (this.pollIntervalTimer) return;
    this.pollIntervalTimer = setInterval(() => {
      this.processQueuedCommands().catch((err) => {
        logger.error('Error during processQueuedCommands polling cycle', err);
      });
    }, intervalMs);
    logger.info(`CommandPublisher polling worker started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stops periodic polling worker.
   */
  public stopPolling(): void {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
      logger.info('CommandPublisher polling worker stopped');
    }
  }

  /**
   * Publishes single faucet command to MQTT device targeting canonical topic with QoS 1 and retain=false.
   */
  public async publishCommand(
    mqttClient: GatewayMqttClient,
    deviceId: string,
    commandId: string,
    commandPayload: Record<string, unknown>,
    siteId = 'site-01'
  ): Promise<{ published: boolean }> {
    if (!mqttClient.isConnected()) {
      logger.warn('Cannot publish command: MQTT client is disconnected', {
        deviceId,
        commandId,
      });
      metricsCollector.incrementCommandFailures();
      return { published: false };
    }

    const rawEnv = this.env?.APP_ENV || process.env.APP_ENV || 'development';
    const envName: AllowedEnvironment =
      rawEnv === 'production' ? 'production' : rawEnv === 'staging' ? 'staging' : 'development';

    const topic = mqttTopicRouter.buildTopic(envName, siteId, deviceId, 'command', 'faucet');

    const payloadObj = {
      schemaVersion: '1.0',
      commandId,
      deviceId,
      siteId,
      action: commandPayload.action || FaucetCommandAction.DISPENSE,
      ...commandPayload,
    };

    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));

    // Faucet commands must never be retained (retain = false), QoS = 1
    await mqttClient.publish(topic, payloadBuffer, 1, false);
    metricsCollector.incrementCommandsPublished();

    logger.info('Faucet command published', {
      deviceId,
      commandId,
      topic,
    });

    return { published: true };
  }

  /**
   * Processes all eligible QUEUED faucet commands for WATER_TANK_NODE devices from database.
   */
  public async processQueuedCommands(): Promise<PublishResult> {
    if (this.isProcessing) {
      return { publishedCount: 0, expiredCount: 0, failedCount: 0, skippedCount: 0 };
    }

    this.isProcessing = true;
    const result: PublishResult = {
      publishedCount: 0,
      expiredCount: 0,
      failedCount: 0,
      skippedCount: 0,
    };

    try {
      if (!this.faucetCommandRepo || !this.deviceRepo || !this.mqttClient) {
        return result;
      }

      // 1. Fetch QUEUED commands
      let paginated;
      try {
        paginated = await this.faucetCommandRepo.getCommands({
          status: FaucetCommandStatus.QUEUED,
          page: 1,
          pageSize: 50,
          sort: 'requestedAt:asc',
        });
      } catch (dbErr) {
        logger.error('Failed to query QUEUED faucet commands from database', dbErr);
        return result;
      }

      if (!paginated || paginated.items.length === 0) {
        return result;
      }

      const now = new Date();

      for (const cmd of paginated.items) {
        // 2. Expiration Check
        if (now >= new Date(cmd.expiresAt)) {
          try {
            await this.faucetCommandRepo.updateCommandStatus(cmd.id, FaucetCommandStatus.EXPIRED, {
              reasonCode: 'EXPIRED_COMMAND',
            });
            logger.info('Faucet command expired before publication', {
              commandId: cmd.commandId,
              deviceId: cmd.deviceId,
              expiresAt: cmd.expiresAt,
            });
            result.expiredCount++;
          } catch (expErr) {
            logger.error('Failed to mark command as EXPIRED', expErr, { commandId: cmd.commandId });
            result.failedCount++;
          }
          continue;
        }

        // 3. Fetch Target Device
        const device = await this.deviceRepo.getDeviceByCanonicalId(cmd.deviceId);
        if (!device) {
          logger.warn('Target device not found for queued faucet command', {
            commandId: cmd.commandId,
            deviceId: cmd.deviceId,
          });
          result.skippedCount++;
          continue;
        }

        // 4. Validate Device Type (Must be WATER_TANK_NODE for MQTT Faucet Commands)
        if (device.deviceType !== DeviceType.WATER_TANK_NODE) {
          logger.warn('Queued faucet command target device is not WATER_TANK_NODE', {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
          });
          result.skippedCount++;
          continue;
        }

        // 5. Validate Device Account Status (Must be ACTIVE)
        if (device.accountStatus !== DeviceAccountStatus.ACTIVE) {
          logger.warn('Queued faucet command target device is not ACTIVE', {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
            accountStatus: device.accountStatus,
          });
          result.skippedCount++;
          continue;
        }

        // 6. Validate Site ID (Never invent a missing siteId)
        if (!device.siteId || device.siteId.trim().length === 0) {
          logger.warn('Queued faucet command target device missing siteId', {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
          });
          result.skippedCount++;
          continue;
        }

        // 7. Validate Phase & Volume if action is DISPENSE
        if (cmd.action === FaucetCommandAction.DISPENSE) {
          let targetVolumeMl: number;
          try {
            targetVolumeMl = mapPhaseToVolume(cmd.phase as number) * (cmd.plantCount as number);
            if (targetVolumeMl !== cmd.targetVolumeMl) {
              logger.warn('Queued faucet command phase and targetVolumeMl mismatch', {
                commandId: cmd.commandId,
                phase: cmd.phase,
                plantCount: cmd.plantCount,
                targetVolumeMl: cmd.targetVolumeMl,
                expectedVolumeMl: targetVolumeMl,
              });
              result.skippedCount++;
              continue;
            }
          } catch (valErr) {
            logger.warn('Invalid faucet command phase', {
              commandId: cmd.commandId,
              phase: cmd.phase,
            });
            result.skippedCount++;
            continue;
          }
        }

        // 8. Check MQTT Client Connection
        if (!this.mqttClient.isConnected()) {
          logger.warn('Cannot publish command: MQTT client is disconnected', {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
          });
          metricsCollector.incrementCommandFailures();
          result.failedCount++;
          break; // Stop processing further commands until MQTT reconnects
        }

        // 9. Build Canonical Topic & Payload
        const rawEnv = this.env?.APP_ENV || process.env.APP_ENV || 'development';
        const envName: AllowedEnvironment =
          rawEnv === 'production' ? 'production' : rawEnv === 'staging' ? 'staging' : 'development';

        const topic = mqttTopicRouter.buildTopic(
          envName,
          device.siteId,
          device.deviceId,
          'command',
          'faucet'
        );

        const payloadObj = {
          schemaVersion: '1.0',
          commandId: cmd.commandId,
          deviceId: device.deviceId,
          siteId: device.siteId,
          action: cmd.action,
          phase: cmd.phase,
          plantCount: cmd.plantCount,
          targetVolumeMl: cmd.targetVolumeMl,
          requestedAt: new Date(cmd.requestedAt).toISOString(),
          expiresAt: new Date(cmd.expiresAt).toISOString(),
        };

        const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));

        // 10. Publish over MQTT (QoS 1, retain false)
        try {
          await this.mqttClient.publish(topic, payloadBuffer, 1, false);

          // 11. Mark SENT, append event, & record metrics ONLY after successful publish
          const messageId = `msg-${crypto.randomUUID()}`;
          await this.faucetCommandRepo.updateCommandStatus(cmd.id, FaucetCommandStatus.SENT, {
            messageId,
            metadata: {
              topic,
              publishedAt: new Date().toISOString(),
            },
          });

          metricsCollector.incrementCommandsPublished();
          logger.info('Faucet command successfully published to MQTT broker', {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
            topic,
            qos: 1,
            retain: false,
          });
          result.publishedCount++;
        } catch (pubErr: any) {
          // Failure: Command remains QUEUED in database
          metricsCollector.incrementCommandFailures();
          logger.error('Failed to publish faucet command to MQTT broker', pubErr, {
            commandId: cmd.commandId,
            deviceId: device.deviceId,
            topic,
          });
          result.failedCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return result;
  }
}

export const commandPublisher = new CommandPublisher();
