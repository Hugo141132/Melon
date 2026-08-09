import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  TelemetryRepository,
  DeviceRepository,
} from '@kebun-melon/database';
import {
  DeviceType,
  ReservoirTelemetryPayloadSchema,
  ReservoirTelemetryPayload,
} from '@kebun-melon/contracts';
import { GatewayMqttClient } from '../mqtt/client';
import { GatewayEnv } from '../config/env';
import { mqttTopicRouter } from '../mqtt/router';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';

export interface TelemetryProcessorOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  prisma?: PrismaClient;
  telemetryRepo?: TelemetryRepository;
  deviceRepo?: DeviceRepository;
}

export class TelemetryProcessor {
  private prisma: PrismaClient | null;
  private telemetryRepo: TelemetryRepository | null;
  private deviceRepo: DeviceRepository | null;
  private mqttClient: GatewayMqttClient | null;
  private env: GatewayEnv | null;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;

  constructor(options: TelemetryProcessorOptions = {}) {
    this.env = options.env || null;
    this.mqttClient = options.mqttClient || null;
    this.prisma = options.prisma ?? defaultPrisma;
    this.telemetryRepo =
      options.telemetryRepo ?? (this.prisma ? new TelemetryRepository(this.prisma) : null);
    this.deviceRepo =
      options.deviceRepo ?? (this.prisma ? new DeviceRepository(this.prisma) : null);
  }

  /**
   * Binds gateway environment and MQTT client.
   */
  public bind(env: GatewayEnv, mqttClient: GatewayMqttClient): void {
    this.env = env;
    this.mqttClient = mqttClient;
  }

  /**
   * Subscribes to canonical reservoir telemetry topics (`telemetry/reservoir`).
   */
  public async subscribeToTelemetry(): Promise<void> {
    if (!this.mqttClient || !this.env) {
      logger.warn('Cannot subscribe to telemetry: MQTT client or env not bound');
      return;
    }

    if (this.isSubscribed) return;

    const topicPattern = mqttTopicRouter.getCategorySubscriptionPattern(
      this.env.APP_ENV,
      'telemetry',
      'reservoir'
    );

    try {
      await this.mqttClient.subscribe(topicPattern);
      this.unsubscribeFn = this.mqttClient.onMessage((topic, payload) => {
        this.processTelemetryMessage(topic, payload).catch((err) => {
          logger.error('Unhandled error processing telemetry message', err, { topic });
        });
      });
      this.isSubscribed = true;
      logger.info('TelemetryProcessor subscribed to reservoir telemetry topics', { topicPattern });
    } catch (err) {
      logger.error('Failed to subscribe to reservoir telemetry topics', err, { topicPattern });
    }
  }

  /**
   * Stops processing and unsubscribes.
   */
  public stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.isSubscribed = false;
  }

  /**
   * Main entry point for processing incoming reservoir telemetry MQTT messages.
   */
  public async processTelemetryMessage(
    topic: string,
    rawPayload: Buffer
  ): Promise<{ success: boolean; reason?: string; readingId?: string; isDuplicate?: boolean }> {
    const expectedEnv = this.env?.APP_ENV || 'development';

    // 1. Topic validation
    const topicValidation = mqttTopicRouter.validateTopic(topic, expectedEnv);
    if (!topicValidation.valid || !topicValidation.parsed) {
      return { success: false, reason: `Invalid topic: ${topicValidation.error}` };
    }

    const parsedTopic = topicValidation.parsed;
    if (parsedTopic.category !== 'telemetry' || parsedTopic.subtype !== 'reservoir') {
      return { success: false, reason: 'Topic is not a reservoir telemetry topic' };
    }

    // 2. Parse JSON payload
    let jsonPayload: unknown;
    try {
      jsonPayload = JSON.parse(rawPayload.toString('utf-8'));
    } catch (err) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Failed to parse reservoir telemetry message JSON payload', { topic });
      return { success: false, reason: 'Invalid JSON payload' };
    }

    // 3. Schema validation
    const schemaValidation = ReservoirTelemetryPayloadSchema.safeParse(jsonPayload);
    if (!schemaValidation.success) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Reservoir telemetry payload failed Zod schema validation', {
        topic,
        errors: schemaValidation.error.errors,
      });
      return { success: false, reason: 'Payload schema validation failed' };
    }

    const payload: ReservoirTelemetryPayload = schemaValidation.data;

    // 4. Topic deviceId vs Payload deviceId matching
    if (parsedTopic.deviceId !== payload.deviceId) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Topic deviceId mismatch with payload deviceId in telemetry', {
        topicDeviceId: parsedTopic.deviceId,
        payloadDeviceId: payload.deviceId,
        topic,
      });
      return { success: false, reason: 'Topic and payload deviceId mismatch' };
    }

    if (!this.telemetryRepo || !this.deviceRepo) {
      logger.warn('Database repositories unavailable for telemetry processing');
      return { success: false, reason: 'Database repositories unavailable' };
    }

    // 5. Resolve target device
    const device = await this.deviceRepo.getDeviceByCanonicalId(payload.deviceId);
    if (!device) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Target device for reservoir telemetry not found in database', {
        deviceId: payload.deviceId,
      });
      return { success: false, reason: 'Device not found' };
    }

    // 6. Enforce WATER_TANK_NODE device type scope
    if (device.deviceType !== DeviceType.WATER_TANK_NODE) {
      logger.warn('Received reservoir telemetry for device that is not a WATER_TANK_NODE', {
        deviceId: payload.deviceId,
        deviceType: device.deviceType,
      });
      return { success: false, reason: 'Device is not a WATER_TANK_NODE' };
    }

    // 7. Enforce topic siteId matches resolved device siteId
    if (device.siteId !== parsedTopic.siteId) {
      logger.warn('Topic siteId mismatch with resolved device siteId', {
        topicSiteId: parsedTopic.siteId,
        deviceSiteId: device.siteId,
        deviceId: payload.deviceId,
      });
      return { success: false, reason: 'Topic siteId mismatch with device site' };
    }

    // 8. Ingest telemetry reading & update lastSeenAt atomically
    try {
      const ingestionResult = await this.telemetryRepo.ingestReservoirReading({
        deviceId: device.id,
        messageId: payload.messageId,
        schemaVersion: payload.schemaVersion,
        sequenceNumber: payload.sequence,
        recordedAt: payload.recordedAt,
        tankVolume: payload.data.tankVolume,
        flowRate: payload.data.flowRate,
        status: payload.data.status,
      });

      logger.info('Reservoir telemetry processed successfully', {
        deviceId: payload.deviceId,
        readingId: ingestionResult.readingId,
        isDuplicate: ingestionResult.isDuplicate,
      });

      return {
        success: true,
        readingId: ingestionResult.readingId,
        isDuplicate: ingestionResult.isDuplicate,
      };
    } catch (err: any) {
      logger.error('Failed to ingest reservoir telemetry reading', err, {
        deviceId: payload.deviceId,
        messageId: payload.messageId,
      });
      return { success: false, reason: err.message };
    }
  }

  /**
   * Legacy helper method for direct programmatic invocation.
   */
  public async processTelemetry(
    deviceId: string,
    telemetryType: 'soil' | 'water' | 'reservoir',
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    logger.debug('Gateway telemetry processor received message', {
      deviceId,
      telemetryType,
      payloadKeys: Object.keys(payload),
    });

    return {
      success: true,
    };
  }
}

export const telemetryProcessor = new TelemetryProcessor();
