import crypto from 'crypto';
import {
  PERMANENT_HARDWARE_TOPICS,
  hardwareMqttReconciliation,
  HardwareMappingContext,
} from './hardware-reconciliation';
import { GatewayMqttClient } from './client';
import { GatewayEnv } from '../config/env';
import {
  TelemetryProcessor,
  telemetryProcessor as defaultTelemetryProcessor,
} from '../telemetry/processor';
import { AllowedEnvironment } from './router';
import {
  FaucetCommandAction,
  ReservoirTelemetryPayload,
  MonitoringStatus,
  DeviceType,
} from '@kebun-melon/contracts';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';
import { DeviceRepository } from '@kebun-melon/database';

export interface HardwareAdapterOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  hardwareMqttClient?: GatewayMqttClient;
  telemetryProcessor?: TelemetryProcessor;
  deviceRepo?: DeviceRepository;
  targetDeviceId?: string;
  targetSiteId?: string;
}

export interface IngestHardwareVolumeResult {
  success: boolean;
  readingId?: string;
  isDuplicate?: boolean;
  reason?: string;
  normalizedVolume?: number;
}

export interface TranslatedHardwareCommand {
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retain: boolean;
}

export class HardwareMqttAdapter {
  private env: GatewayEnv | null = null;
  private internalClient: GatewayMqttClient | null = null;
  private hardwareClient: GatewayMqttClient | null = null;
  private telemetryProcessor: TelemetryProcessor;
  private deviceRepo: DeviceRepository | null = null;
  private targetDeviceId: string;
  private targetSiteId: string;
  private sequenceCounter = 0;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;
  private isExplicitlySet = false;

  constructor(options: HardwareAdapterOptions = {}) {
    this.env = options.env || null;
    this.internalClient = options.mqttClient || null;
    this.hardwareClient = options.hardwareMqttClient || null;
    this.telemetryProcessor = options.telemetryProcessor || defaultTelemetryProcessor;
    this.deviceRepo = options.deviceRepo || null;
    this.targetDeviceId =
      options.targetDeviceId ||
      options.env?.WATER_TANK_DEVICE_ID ||
      options.env?.HARDWARE_TARGET_DEVICE_ID ||
      'water-tank-node-zi37gz';
    this.targetSiteId = options.targetSiteId || 'site-01';
  }

  public bind(
    env: GatewayEnv,
    internalClient: GatewayMqttClient,
    hardwareClient?: GatewayMqttClient,
    deviceRepo?: DeviceRepository
  ): void {
    this.env = env;
    this.internalClient = internalClient;
    this.hardwareClient = hardwareClient || null;
    if (deviceRepo) {
      this.deviceRepo = deviceRepo;
    }
    const resolvedEnvId = env.WATER_TANK_DEVICE_ID || env.HARDWARE_TARGET_DEVICE_ID;
    if (resolvedEnvId) {
      this.targetDeviceId = resolvedEnvId;
    }
  }

  public async resolveTargetDeviceId(): Promise<string> {
    if (this.isExplicitlySet) {
      return this.targetDeviceId;
    }

    // 1. Explicit environment variable check
    const envDeviceId = this.env?.WATER_TANK_DEVICE_ID || this.env?.HARDWARE_TARGET_DEVICE_ID;
    if (envDeviceId && envDeviceId.trim().length > 0) {
      this.targetDeviceId = envDeviceId.trim();
      return this.targetDeviceId;
    }

    // 2. Database lookup fallback if deviceRepo is available
    if (this.deviceRepo) {
      try {
        const paginated = await this.deviceRepo.getDevices({
          deviceType: DeviceType.WATER_TANK_NODE,
          page: 1,
          pageSize: 5,
          sort: 'createdAt:desc',
        });

        const activeTankNodes = paginated.items.filter((d) => d.accountStatus === 'ACTIVE');
        if (activeTankNodes.length > 0) {
          if (activeTankNodes.length > 1) {
            logger.warn(
              'Multiple active WATER_TANK_NODE devices found in database. Using first active node.',
              { count: activeTankNodes.length, selected: activeTankNodes[0].deviceId }
            );
          }
          this.targetDeviceId = activeTankNodes[0].deviceId;
          if (activeTankNodes[0].siteId) {
            this.targetSiteId = activeTankNodes[0].siteId;
          }
          return this.targetDeviceId;
        }
      } catch (err) {
        logger.error('Failed to resolve WATER_TANK_NODE from database, using cached fallback', err);
      }
    }

    return this.targetDeviceId;
  }

  public getTargetDeviceId(): string {
    return this.targetDeviceId;
  }

  public setTargetDeviceId(deviceId: string): void {
    this.targetDeviceId = deviceId;
    this.isExplicitlySet = true;
  }

  public getEffectiveHardwareClient(): GatewayMqttClient | null {
    return this.hardwareClient || this.internalClient;
  }

  public isConfigured(): boolean {
    return (
      this.env !== null &&
      (this.env.HARDWARE_ADAPTER_ENABLED ?? true) &&
      this.getEffectiveHardwareClient() !== null
    );
  }

  /**
   * Starts subscription to the external hardware volume topic.
   */
  public async start(): Promise<void> {
    const client = this.getEffectiveHardwareClient();
    if (!client || !this.env) {
      logger.warn('Cannot start HardwareMqttAdapter: client or env not bound');
      return;
    }

    if (!this.env.HARDWARE_ADAPTER_ENABLED) {
      logger.info('HardwareMqttAdapter is disabled via HARDWARE_ADAPTER_ENABLED=false');
      return;
    }

    if (this.isSubscribed) return;

    const topic = PERMANENT_HARDWARE_TOPICS.topicVolume;

    try {
      await client.subscribe(topic);
      this.unsubscribeFn = client.onMessage((receivedTopic, payload) => {
        if (receivedTopic === topic) {
          this.handleInboundHardwareVolume(payload).catch((err) => {
            logger.error('Unhandled error processing hardware volume message', err, {
              topic: receivedTopic,
            });
          });
        }
      });
      this.isSubscribed = true;
      logger.info('HardwareMqttAdapter subscribed to external volume topic', { topic });
    } catch (err: any) {
      logger.error('Failed to subscribe HardwareMqttAdapter to external volume topic', err, {
        topic,
      });
    }
  }

  /**
   * Stops listening to external hardware topics.
   */
  public stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.isSubscribed = false;
  }

  /**
   * Parses and normalizes incoming raw volume data from hardware.
   * Supports:
   * 1. Primitive number (e.g. 120.5)
   * 2. Primitive string (e.g. "120.5")
   * 3. JSON with volume / tankVolume (e.g. {"volume": 120.5}, {"tankVolume": 120.5}, {"volume": "120.5"})
   */
  public normalizeRawVolume(rawPayload: Buffer | string): number | null {
    const payloadStr = (
      Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload
    ).trim();

    if (!payloadStr) {
      return null;
    }

    // Try parsing as JSON first
    if (payloadStr.startsWith('{') && payloadStr.endsWith('}')) {
      try {
        const parsed = JSON.parse(payloadStr);
        if (typeof parsed === 'object' && parsed !== null) {
          const candidate = parsed.tankVolume ?? parsed.volume ?? parsed.value ?? parsed.liter;
          if (candidate !== undefined && candidate !== null) {
            const num = Number(candidate);
            if (Number.isFinite(num) && num >= 0) {
              return num;
            }
          }
        }
      } catch {
        // Fall back to direct numeric parsing
      }
    }

    // Direct numeric parsing
    const directNum = Number(payloadStr);
    if (Number.isFinite(directNum) && directNum >= 0) {
      return directNum;
    }

    return null;
  }

  /**
   * Ingests, normalizes, and routes external hardware volume messages into the canonical telemetry pipeline.
   */
  public async handleInboundHardwareVolume(
    rawPayload: Buffer | string
  ): Promise<IngestHardwareVolumeResult> {
    const volume = this.normalizeRawVolume(rawPayload);

    if (volume === null) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Hardware volume message rejected: invalid or negative volume value', {
        rawPayload: Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload,
      });
      return {
        success: false,
        reason: 'INVALID_VOLUME_PAYLOAD',
      };
    }

    const rawEnv = this.env?.APP_ENV || process.env.APP_ENV || 'development';
    const envName: AllowedEnvironment =
      rawEnv === 'production' ? 'production' : rawEnv === 'staging' ? 'staging' : 'development';

    const context: HardwareMappingContext = {
      environment: envName,
      siteId: this.targetSiteId,
      deviceId: this.targetDeviceId,
    };

    const mapping = hardwareMqttReconciliation.mapHardwareTopicToCanonical(
      PERMANENT_HARDWARE_TOPICS.topicVolume,
      context
    );

    if (!mapping.reconciled || !mapping.canonicalTopic) {
      logger.error('Failed to map hardware topic to canonical topic', {
        error: mapping.error,
        unresolvedReasons: mapping.unresolvedReasons,
      });
      return {
        success: false,
        reason: mapping.error || 'TOPIC_MAPPING_FAILED',
      };
    }

    // Anti-republish loop guard
    const loopCheck = hardwareMqttReconciliation.checkRepublishLoopGuard(
      PERMANENT_HARDWARE_TOPICS.topicVolume,
      mapping.canonicalTopic
    );
    if (!loopCheck.isSafe) {
      logger.error('Republish loop detected during hardware ingestion', {
        reason: loopCheck.reason,
      });
      return {
        success: false,
        reason: loopCheck.reason || 'LOOP_DETECTED',
      };
    }

    // Resolve target device ID (env config with database fallback)
    await this.resolveTargetDeviceId();

    // Build canonical ReservoirTelemetryPayload
    const messageId = `hw-vol-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const normalizedPayload: ReservoirTelemetryPayload = {
      schemaVersion: '1.0',
      messageId,
      deviceId: this.targetDeviceId,
      siteId: this.targetSiteId,
      sequence: ++this.sequenceCounter,
      recordedAt: timestamp,
      sentAt: timestamp,
      firmwareVersion: '1.0.0-hw',
      data: {
        tankVolume: volume,
        status: MonitoringStatus.NORMAL,
      },
    };

    const canonicalBuffer = Buffer.from(JSON.stringify(normalizedPayload));

    // Ingest into TelemetryProcessor (which validates and updates DB/timestamps/SSE)
    const result = await this.telemetryProcessor.processTelemetryMessage(
      mapping.canonicalTopic,
      canonicalBuffer
    );

    if (result.success) {
      logger.info('Normalized hardware volume successfully ingested into canonical pipeline', {
        readingId: result.readingId,
        deviceId: this.targetDeviceId,
        normalizedVolume: volume,
      });
    }

    return {
      success: result.success,
      readingId: result.readingId,
      isDuplicate: result.isDuplicate,
      reason: result.reason,
      normalizedVolume: volume,
    };
  }

  /**
   * Translates an internal backend faucet command into hardware topic format.
   */
  public translateCommand(commandPayload: {
    action: FaucetCommandAction | string;
    targetVolumeMl?: number | null;
    phase?: string | number | null;
    plantCount?: number | null;
  }): TranslatedHardwareCommand | null {
    const action = commandPayload.action || FaucetCommandAction.DISPENSE;

    if (action === FaucetCommandAction.OPEN) {
      return {
        topic: PERMANENT_HARDWARE_TOPICS.topicValve,
        payload: 'ON',
        qos: 1,
        retain: false,
      };
    }

    if (action === FaucetCommandAction.CLOSE) {
      return {
        topic: PERMANENT_HARDWARE_TOPICS.topicValve,
        payload: 'OFF',
        qos: 1,
        retain: false,
      };
    }

    if (action === FaucetCommandAction.DISPENSE) {
      const volumeMl = commandPayload.targetVolumeMl ?? 0;
      const targetLiter = Number((volumeMl / 1000).toFixed(2));
      return {
        topic: PERMANENT_HARDWARE_TOPICS.topicOtomasi,
        payload: JSON.stringify({
          mode: 'AUTO',
          target_liter: targetLiter,
        }),
        qos: 1,
        retain: false,
      };
    }

    return null;
  }

  /**
   * Translates and dispatches a faucet command to hardware topics, adhering strictly to ENABLE_FAUCET_CONTROL.
   */
  public async dispatchHardwareCommand(commandPayload: {
    action: FaucetCommandAction | string;
    targetVolumeMl?: number | null;
    phase?: string | number | null;
    plantCount?: number | null;
    deviceId?: string;
  }): Promise<{ published: boolean; reason?: string; translated?: TranslatedHardwareCommand }> {
    // 1. Safety check
    if (!this.env?.ENABLE_FAUCET_CONTROL) {
      logger.warn('Hardware command dispatch rejected: ENABLE_FAUCET_CONTROL is false', {
        action: commandPayload.action,
        deviceId: commandPayload.deviceId,
      });
      return {
        published: false,
        reason: 'ENABLE_FAUCET_CONTROL_DISABLED',
      };
    }

    // 2. Translate command
    const translated = this.translateCommand(commandPayload);
    if (!translated) {
      logger.warn('Cannot translate command to hardware topics: unsupported action', {
        action: commandPayload.action,
      });
      return {
        published: false,
        reason: 'UNSUPPORTED_HARDWARE_COMMAND_ACTION',
      };
    }

    const client = this.getEffectiveHardwareClient();
    if (!client || !client.isConnected()) {
      logger.warn('Hardware MQTT client is disconnected. Cannot publish hardware command.', {
        translatedTopic: translated.topic,
      });
      return {
        published: false,
        reason: 'HARDWARE_MQTT_DISCONNECTED',
        translated,
      };
    }

    try {
      const payloadBuf = Buffer.from(translated.payload);
      await client.publish(translated.topic, payloadBuf, translated.qos, translated.retain);
      logger.info('Translated hardware command published successfully', {
        topic: translated.topic,
        payload: translated.payload,
        action: commandPayload.action,
      });
      return {
        published: true,
        translated,
      };
    } catch (err: any) {
      logger.error('Failed to publish translated hardware command', err, {
        topic: translated.topic,
      });
      return {
        published: false,
        reason: err.message,
        translated,
      };
    }
  }
}

export const hardwareMqttAdapter = new HardwareMqttAdapter();
