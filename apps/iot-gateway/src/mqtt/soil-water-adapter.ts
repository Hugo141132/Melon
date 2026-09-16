import crypto from 'crypto';
import { GatewayMqttClient } from './client';
import { GatewayEnv } from '../config/env';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';
import { publishRealtimeEvent } from '../events/webhook';
import {
  DeviceRepository,
  TelemetryRepository,
  DeviceNotFoundError,
  DeviceInactiveError,
} from '@kebun-melon/database';
import {
  DeviceType,
  MonitoringStatus,
  SoilTelemetryDataSchema,
  WaterTelemetryDataSchema,
} from '@kebun-melon/contracts';

export const SOIL_WATER_TOPICS = {
  SOIL_DATA: 'melon/sensor-tanah/data-2424600050',
  SOIL_RECOMMENDATION: 'melon/ai-tanah/rekomendasi-2424600050',
  WATER_DATA: 'melon/sensor-air/data-2424600050',
  WATER_RECOMMENDATION: 'melon/ai-air/rekomendasi-2424600050',
} as const;

export const DEFAULT_HARDWARE_CLIENTS = {
  SOIL: 'melon-esp32-tanah1',
  WATER: 'melon-esp32-air1',
} as const;

export interface SoilWaterAdapterOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  telemetryRepo?: TelemetryRepository;
  deviceRepo?: DeviceRepository;
}

export interface IngestSoilResult {
  success: boolean;
  readingId?: string;
  isDuplicate?: boolean;
  reason?: string;
}

export interface IngestWaterResult {
  success: boolean;
  readingId?: string;
  isDuplicate?: boolean;
  reason?: string;
}

export class SoilWaterMqttAdapter {
  private env: GatewayEnv | null = null;
  private mqttClient: GatewayMqttClient | null = null;
  private telemetryRepo: TelemetryRepository | null = null;
  private deviceRepo: DeviceRepository | null = null;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;
  private deviceCache = new Map<string, { deviceId: string; id: string; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 30000;

  constructor(options: SoilWaterAdapterOptions = {}) {
    this.env = options.env || null;
    this.mqttClient = options.mqttClient || null;
    this.telemetryRepo = options.telemetryRepo || null;
    this.deviceRepo = options.deviceRepo || null;
  }

  public getSoilDataTopic(): string {
    return this.env?.SOIL_MQTT_PUB_TOPIC || SOIL_WATER_TOPICS.SOIL_DATA;
  }

  public getSoilRecommendationTopic(): string {
    return this.env?.SOIL_MQTT_SUB_TOPIC || SOIL_WATER_TOPICS.SOIL_RECOMMENDATION;
  }

  public getWaterDataTopic(): string {
    return this.env?.WATER_MQTT_PUB_TOPIC || SOIL_WATER_TOPICS.WATER_DATA;
  }

  public getWaterRecommendationTopic(): string {
    return this.env?.WATER_MQTT_SUB_TOPIC || SOIL_WATER_TOPICS.WATER_RECOMMENDATION;
  }

  public bind(
    env: GatewayEnv,
    mqttClient: GatewayMqttClient,
    telemetryRepo?: TelemetryRepository,
    deviceRepo?: DeviceRepository
  ): void {
    this.env = env;
    this.mqttClient = mqttClient;
    if (telemetryRepo) this.telemetryRepo = telemetryRepo;
    if (deviceRepo) this.deviceRepo = deviceRepo;
  }

  public clearDeviceCache(): void {
    this.deviceCache.clear();
  }

  /**
   * Dynamically resolves database deviceId for SOIL_NODE using MQTT client identity.
   * Priority:
   * 1. Check in-memory resolution cache (TTL 30s)
   * 2. Query devices by client_id = targetClientId (primary identity source)
   * 3. Query devices by canonical deviceId / UUID (if incoming identifier was specified)
   * Returns canonical deviceId if active SOIL_NODE, or null if unknown/unauthorized.
   * DOES NOT fall back to arbitrary active device.
   */
  public async resolveSoilDeviceId(incomingClientId?: string): Promise<string | null> {
    if (!incomingClientId || !incomingClientId.trim()) {
      return null;
    }
    const targetClientId = incomingClientId.trim();

    const cached = this.deviceCache.get(targetClientId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.deviceId;
    }

    if (this.deviceRepo) {
      try {
        // 1. Primary identity: Lookup by client_id in database registry
        const deviceByClient = await this.deviceRepo.getDeviceByClientId(targetClientId);
        if (deviceByClient) {
          if (
            deviceByClient.deviceType === DeviceType.SOIL_NODE &&
            deviceByClient.accountStatus === 'ACTIVE'
          ) {
            this.deviceCache.set(targetClientId, {
              deviceId: deviceByClient.deviceId,
              id: deviceByClient.id,
              cachedAt: Date.now(),
            });
            return deviceByClient.deviceId;
          }
          logger.warn(
            'Device with clientId found but incompatible or inactive for soil telemetry',
            {
              clientId: targetClientId,
              deviceType: deviceByClient.deviceType,
              accountStatus: deviceByClient.accountStatus,
            }
          );
          return null;
        }

        // 2. Canonical deviceId / UUID lookup (if explicitly provided)
        const deviceByCanonical = await this.deviceRepo.getDeviceByCanonicalId(targetClientId);
        if (deviceByCanonical) {
          if (
            deviceByCanonical.deviceType === DeviceType.SOIL_NODE &&
            deviceByCanonical.accountStatus === 'ACTIVE'
          ) {
            this.deviceCache.set(targetClientId, {
              deviceId: deviceByCanonical.deviceId,
              id: deviceByCanonical.id,
              cachedAt: Date.now(),
            });
            return deviceByCanonical.deviceId;
          }
          logger.warn(
            'Device with canonical ID found but incompatible or inactive for soil telemetry',
            {
              deviceId: targetClientId,
              deviceType: deviceByCanonical.deviceType,
              accountStatus: deviceByCanonical.accountStatus,
            }
          );
          return null;
        }
      } catch (err) {
        logger.error('Failed to resolve SOIL_NODE from database registry', err, {
          clientId: targetClientId,
        });
      }
    }

    // Explicit rejection: unknown or unmapped device
    return null;
  }

  /**
   * Dynamically resolves database deviceId for WATER_QUALITY_NODE using MQTT client identity.
   * Priority:
   * 1. Check in-memory resolution cache (TTL 30s)
   * 2. Query devices by client_id = targetClientId (primary identity source)
   * 3. Query devices by canonical deviceId / UUID (if incoming identifier was specified)
   * Returns canonical deviceId if active WATER_QUALITY_NODE, or null if unknown/unauthorized.
   * DOES NOT fall back to arbitrary active device.
   */
  public async resolveWaterDeviceId(incomingClientId?: string): Promise<string | null> {
    if (!incomingClientId || !incomingClientId.trim()) {
      return null;
    }
    const targetClientId = incomingClientId.trim();

    const cached = this.deviceCache.get(targetClientId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.deviceId;
    }

    if (this.deviceRepo) {
      try {
        // 1. Primary identity: Lookup by client_id in database registry
        const deviceByClient = await this.deviceRepo.getDeviceByClientId(targetClientId);
        if (deviceByClient) {
          if (
            deviceByClient.deviceType === DeviceType.WATER_QUALITY_NODE &&
            deviceByClient.accountStatus === 'ACTIVE'
          ) {
            this.deviceCache.set(targetClientId, {
              deviceId: deviceByClient.deviceId,
              id: deviceByClient.id,
              cachedAt: Date.now(),
            });
            return deviceByClient.deviceId;
          }
          logger.warn(
            'Device with clientId found but incompatible or inactive for water quality telemetry',
            {
              clientId: targetClientId,
              deviceType: deviceByClient.deviceType,
              accountStatus: deviceByClient.accountStatus,
            }
          );
          return null;
        }

        // 2. Canonical deviceId / UUID lookup (if explicitly provided)
        const deviceByCanonical = await this.deviceRepo.getDeviceByCanonicalId(targetClientId);
        if (deviceByCanonical) {
          if (
            deviceByCanonical.deviceType === DeviceType.WATER_QUALITY_NODE &&
            deviceByCanonical.accountStatus === 'ACTIVE'
          ) {
            this.deviceCache.set(targetClientId, {
              deviceId: deviceByCanonical.deviceId,
              id: deviceByCanonical.id,
              cachedAt: Date.now(),
            });
            return deviceByCanonical.deviceId;
          }
          logger.warn(
            'Device with canonical ID found but incompatible or inactive for water quality telemetry',
            {
              deviceId: targetClientId,
              deviceType: deviceByCanonical.deviceType,
              accountStatus: deviceByCanonical.accountStatus,
            }
          );
          return null;
        }
      } catch (err) {
        logger.error('Failed to resolve WATER_QUALITY_NODE from database registry', err, {
          clientId: targetClientId,
        });
      }
    }

    // Explicit rejection: unknown or unmapped device
    return null;
  }

  public isConfigured(): boolean {
    return (
      this.env !== null && (this.env.SOIL_WATER_ADAPTER_ENABLED ?? true) && this.mqttClient !== null
    );
  }

  /**
   * Starts listening to soil and water quality telemetry MQTT topics.
   */
  public async start(): Promise<void> {
    if (!this.mqttClient || !this.env) {
      logger.warn('Cannot start SoilWaterMqttAdapter: client or env not bound');
      return;
    }

    if (!this.env.SOIL_WATER_ADAPTER_ENABLED) {
      logger.info('SoilWaterMqttAdapter is disabled via SOIL_WATER_ADAPTER_ENABLED=false');
      return;
    }

    if (this.isSubscribed) return;

    const soilTopic = this.getSoilDataTopic();
    const waterTopic = this.getWaterDataTopic();
    const topics = [soilTopic, waterTopic];

    try {
      await this.mqttClient.subscribe(topics);
      this.unsubscribeFn = this.mqttClient.onMessage((receivedTopic, payload) => {
        if (receivedTopic === soilTopic) {
          this.handleInboundSoilData(payload).catch((err) => {
            logger.error('Unhandled error processing soil data message', err, {
              topic: receivedTopic,
            });
          });
        } else if (receivedTopic === waterTopic) {
          this.handleInboundWaterData(payload).catch((err) => {
            logger.error('Unhandled error processing water data message', err, {
              topic: receivedTopic,
            });
          });
        }
      });
      this.isSubscribed = true;
      logger.info('SoilWaterMqttAdapter subscribed to soil and water data topics', { topics });
    } catch (err: any) {
      logger.error('Failed to subscribe SoilWaterMqttAdapter to data topics', err, { topics });
    }
  }

  public stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.isSubscribed = false;
  }

  /**
   * Parses raw payload from soil equipment into normalized data fields.
   */
  public normalizeSoilPayload(rawPayload: Buffer | string): {
    messageId?: string;
    deviceId?: string;
    clientId?: string;
    recordedAt?: string;
    sequence?: number;
    data: {
      nitrogen: number | null;
      phosphorus: number | null;
      potassium: number | null;
      temperature: number | null;
      moisture: number | null;
      ph: number | null;
      ec: number | null;
      status: MonitoringStatus | null;
    };
  } | null {
    const payloadStr = (
      Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload
    ).trim();

    if (!payloadStr) return null;

    let parsed: any;
    try {
      parsed = JSON.parse(payloadStr);
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    // Determine if wrapped in canonical envelope or flat
    const rawData = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

    const toFiniteOrNull = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const n = toFiniteOrNull(rawData.nitrogen ?? rawData.n ?? rawData.N);
    const p = toFiniteOrNull(rawData.phosphorus ?? rawData.p ?? rawData.P);
    const k = toFiniteOrNull(rawData.potassium ?? rawData.k ?? rawData.K);
    const temp = toFiniteOrNull(rawData.temperature ?? rawData.temp ?? rawData.suhu);
    const moisture = toFiniteOrNull(
      rawData.moisture ?? rawData.humidity ?? rawData.hum ?? rawData.kelembapan
    );
    const ph = toFiniteOrNull(rawData.ph ?? rawData.pH);
    const ec = toFiniteOrNull(rawData.ec ?? rawData.EC);

    let status: MonitoringStatus | null = null;
    const rawStatus = (rawData.status || parsed.status || '').toUpperCase();
    if (Object.values(MonitoringStatus).includes(rawStatus as MonitoringStatus)) {
      status = rawStatus as MonitoringStatus;
    } else {
      status = MonitoringStatus.NORMAL;
    }

    // Must contain at least one valid metric
    if ([n, p, k, temp, moisture, ph, ec].every((v) => v === null)) {
      return null;
    }

    const rawClientId = parsed.clientId || parsed.client_id || parsed.deviceId || undefined;
    const clientId =
      typeof rawClientId === 'string' && rawClientId.trim().length > 0
        ? rawClientId.trim()
        : undefined;

    return {
      messageId: parsed.messageId || `msg-soil-${crypto.randomUUID()}`,
      deviceId: parsed.deviceId || undefined,
      clientId,
      recordedAt: parsed.recordedAt || parsed.timestamp || new Date().toISOString(),
      sequence: typeof parsed.sequence === 'number' ? parsed.sequence : undefined,
      data: {
        nitrogen: n,
        phosphorus: p,
        potassium: k,
        temperature: temp,
        moisture,
        ph,
        ec,
        status,
      },
    };
  }

  /**
   * Ingests, normalizes, and stores incoming soil telemetry messages.
   */
  public async handleInboundSoilData(rawPayload: Buffer | string): Promise<IngestSoilResult> {
    const normalized = this.normalizeSoilPayload(rawPayload);

    if (!normalized) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Soil telemetry message rejected: invalid schema or values', {
        rawPayload: Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload,
      });
      return { success: false, reason: 'INVALID_SOIL_PAYLOAD' };
    }

    const validation = SoilTelemetryDataSchema.safeParse(normalized.data);
    if (!validation.success) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Soil telemetry data schema validation failed', {
        errors: validation.error.errors,
      });
      return { success: false, reason: 'VALIDATION_FAILED' };
    }

    const incomingIdentifier = normalized.clientId || normalized.deviceId;
    if (!incomingIdentifier) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Soil telemetry message rejected: missing hardware clientId in payload', {
        messageId: normalized.messageId,
      });
      return { success: false, reason: 'MISSING_CLIENT_ID' };
    }

    const targetDeviceId = await this.resolveSoilDeviceId(incomingIdentifier);
    if (!targetDeviceId) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn('Soil telemetry message rejected: unknown or unauthorized device clientId', {
        clientId: incomingIdentifier,
      });
      return { success: false, reason: 'UNKNOWN_DEVICE_CLIENT_ID' };
    }

    if (!this.telemetryRepo) {
      logger.warn('TelemetryRepository not available for soil telemetry ingestion');
      return { success: false, reason: 'REPOSITORY_UNAVAILABLE' };
    }

    try {
      const result = await this.telemetryRepo.ingestSoilReading({
        deviceId: targetDeviceId,
        messageId: normalized.messageId!,
        schemaVersion: '1.0',
        sequenceNumber: normalized.sequence,
        recordedAt: normalized.recordedAt,
        nitrogen: normalized.data.nitrogen,
        phosphorus: normalized.data.phosphorus,
        potassium: normalized.data.potassium,
        temperature: normalized.data.temperature,
        moisture: normalized.data.moisture,
        ph: normalized.data.ph,
        ec: normalized.data.ec,
        status: normalized.data.status,
      });

      if (!result.isDuplicate) {
        const receivedAtIso = (
          result.receivedAt instanceof Date ? result.receivedAt : new Date()
        ).toISOString();
        const recordedAtIso =
          result.recordedAt instanceof Date ? result.recordedAt.toISOString() : null;

        await publishRealtimeEvent(
          this.env,
          'telemetry.soil.updated',
          {
            readingId: result.readingId,
            deviceId: result.deviceId,
            canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
            messageId: result.messageId,
            recordedAt: recordedAtIso,
            receivedAt: receivedAtIso,
            nitrogen: normalized.data.nitrogen,
            phosphorus: normalized.data.phosphorus,
            potassium: normalized.data.potassium,
            temperature: normalized.data.temperature,
            moisture: normalized.data.moisture,
            ph: normalized.data.ph,
            ec: normalized.data.ec,
            status: normalized.data.status,
            validationStatus: result.validationStatus,
          },
          result.canonicalDeviceId || targetDeviceId
        );

        await publishRealtimeEvent(
          this.env,
          'device.status.updated',
          {
            deviceId: result.deviceId,
            canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
            connectionStatus: 'ONLINE',
            lastSeenAt: receivedAtIso,
          },
          result.canonicalDeviceId || targetDeviceId
        );
      }

      logger.info('Soil telemetry message ingested successfully via MQTT', {
        readingId: result.readingId,
        deviceId: result.canonicalDeviceId || targetDeviceId,
        isDuplicate: result.isDuplicate,
      });

      return {
        success: true,
        readingId: result.readingId,
        isDuplicate: result.isDuplicate,
      };
    } catch (err: any) {
      if (err instanceof DeviceNotFoundError || err?.name === 'DeviceNotFoundError') {
        metricsCollector.incrementUnknownDeviceAttempts();
        logger.warn('Target device for soil telemetry not found in database', {
          deviceId: targetDeviceId,
        });
        return { success: false, reason: 'DEVICE_NOT_FOUND' };
      }
      if (err instanceof DeviceInactiveError || err?.name === 'DeviceInactiveError') {
        logger.warn('Target device for soil telemetry is inactive', {
          deviceId: targetDeviceId,
        });
        return { success: false, reason: 'DEVICE_INACTIVE' };
      }

      logger.error('Failed to ingest soil telemetry reading via MQTT', err, {
        deviceId: targetDeviceId,
      });
      return { success: false, reason: err.message || 'INGESTION_FAILED' };
    }
  }

  /**
   * Parses raw payload from water quality equipment into normalized data fields.
   */
  public normalizeWaterPayload(rawPayload: Buffer | string): {
    messageId?: string;
    deviceId?: string;
    clientId?: string;
    recordedAt?: string;
    sequence?: number;
    data: {
      ph: number | null;
      tds: number | null;
      ec: number | null;
      status: MonitoringStatus | null;
    };
  } | null {
    const payloadStr = (
      Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload
    ).trim();

    if (!payloadStr) return null;

    let parsed: any;
    try {
      parsed = JSON.parse(payloadStr);
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const rawData = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

    const toFiniteOrNull = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const ph = toFiniteOrNull(rawData.ph ?? rawData.pH);
    const tds = toFiniteOrNull(rawData.tds ?? rawData.TDS);
    const ec = toFiniteOrNull(rawData.ec ?? rawData.EC);

    let status: MonitoringStatus | null = null;
    const rawStatus = (rawData.status || parsed.status || '').toUpperCase();
    if (Object.values(MonitoringStatus).includes(rawStatus as MonitoringStatus)) {
      status = rawStatus as MonitoringStatus;
    } else {
      status = MonitoringStatus.NORMAL;
    }

    if ([ph, tds, ec].every((v) => v === null)) {
      return null;
    }

    const rawClientId = parsed.clientId || parsed.client_id || parsed.deviceId || undefined;
    const clientId =
      typeof rawClientId === 'string' && rawClientId.trim().length > 0
        ? rawClientId.trim()
        : undefined;

    return {
      messageId: parsed.messageId || `msg-water-${crypto.randomUUID()}`,
      deviceId: parsed.deviceId || undefined,
      clientId,
      recordedAt: parsed.recordedAt || parsed.timestamp || new Date().toISOString(),
      sequence: typeof parsed.sequence === 'number' ? parsed.sequence : undefined,
      data: {
        ph,
        tds,
        ec,
        status,
      },
    };
  }

  /**
   * Ingests, normalizes, and stores incoming water quality telemetry messages.
   */
  public async handleInboundWaterData(rawPayload: Buffer | string): Promise<IngestWaterResult> {
    const normalized = this.normalizeWaterPayload(rawPayload);

    if (!normalized) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Water quality telemetry message rejected: invalid schema or values', {
        rawPayload: Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : rawPayload,
      });
      return { success: false, reason: 'INVALID_WATER_PAYLOAD' };
    }

    const validation = WaterTelemetryDataSchema.safeParse(normalized.data);
    if (!validation.success) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn('Water quality telemetry data schema validation failed', {
        errors: validation.error.errors,
      });
      return { success: false, reason: 'VALIDATION_FAILED' };
    }

    const incomingIdentifier = normalized.clientId || normalized.deviceId;
    if (!incomingIdentifier) {
      metricsCollector.incrementMessagesInvalid();
      logger.warn(
        'Water quality telemetry message rejected: missing hardware clientId in payload',
        {
          messageId: normalized.messageId,
        }
      );
      return { success: false, reason: 'MISSING_CLIENT_ID' };
    }

    const targetDeviceId = await this.resolveWaterDeviceId(incomingIdentifier);
    if (!targetDeviceId) {
      metricsCollector.incrementUnknownDeviceAttempts();
      logger.warn(
        'Water quality telemetry message rejected: unknown or unauthorized device clientId',
        {
          clientId: incomingIdentifier,
        }
      );
      return { success: false, reason: 'UNKNOWN_DEVICE_CLIENT_ID' };
    }

    if (!this.telemetryRepo) {
      logger.warn('TelemetryRepository not available for water telemetry ingestion');
      return { success: false, reason: 'REPOSITORY_UNAVAILABLE' };
    }

    try {
      const result = await this.telemetryRepo.ingestWaterReading({
        deviceId: targetDeviceId,
        messageId: normalized.messageId!,
        schemaVersion: '1.0',
        sequenceNumber: normalized.sequence,
        recordedAt: normalized.recordedAt,
        ph: normalized.data.ph,
        tds: normalized.data.tds,
        ec: normalized.data.ec,
        status: normalized.data.status,
      });

      if (!result.isDuplicate) {
        const receivedAtIso = (
          result.receivedAt instanceof Date ? result.receivedAt : new Date()
        ).toISOString();
        const recordedAtIso =
          result.recordedAt instanceof Date ? result.recordedAt.toISOString() : null;

        await publishRealtimeEvent(
          this.env,
          'telemetry.water.updated',
          {
            readingId: result.readingId,
            deviceId: result.deviceId,
            canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
            messageId: result.messageId,
            recordedAt: recordedAtIso,
            receivedAt: receivedAtIso,
            ph: normalized.data.ph,
            tds: normalized.data.tds,
            ec: normalized.data.ec,
            status: normalized.data.status,
            validationStatus: result.validationStatus,
          },
          result.canonicalDeviceId || targetDeviceId
        );

        await publishRealtimeEvent(
          this.env,
          'device.status.updated',
          {
            deviceId: result.deviceId,
            canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
            connectionStatus: 'ONLINE',
            lastSeenAt: receivedAtIso,
          },
          result.canonicalDeviceId || targetDeviceId
        );
      }

      logger.info('Water quality telemetry message ingested successfully via MQTT', {
        readingId: result.readingId,
        deviceId: result.canonicalDeviceId || targetDeviceId,
        isDuplicate: result.isDuplicate,
      });

      return {
        success: true,
        readingId: result.readingId,
        isDuplicate: result.isDuplicate,
      };
    } catch (err: any) {
      if (err instanceof DeviceNotFoundError || err?.name === 'DeviceNotFoundError') {
        metricsCollector.incrementUnknownDeviceAttempts();
        logger.warn('Target device for water quality telemetry not found in database', {
          deviceId: targetDeviceId,
        });
        return { success: false, reason: 'DEVICE_NOT_FOUND' };
      }
      if (err instanceof DeviceInactiveError || err?.name === 'DeviceInactiveError') {
        logger.warn('Target device for water quality telemetry is inactive', {
          deviceId: targetDeviceId,
        });
        return { success: false, reason: 'DEVICE_INACTIVE' };
      }

      logger.error('Failed to ingest water quality telemetry reading via MQTT', err, {
        deviceId: targetDeviceId,
      });
      return { success: false, reason: err.message || 'INGESTION_FAILED' };
    }
  }

  /**
   * Publishes recommendation payload to soil device recommendation topic.
   */
  public async publishSoilRecommendation(payload: Record<string, unknown>): Promise<boolean> {
    if (!this.mqttClient) {
      logger.warn('Cannot publish soil recommendation: MQTT client not bound');
      return false;
    }

    try {
      const topic = this.getSoilRecommendationTopic();
      const json = JSON.stringify(payload);
      await this.mqttClient.publish(topic, json, 1, false);
      logger.info('Published soil recommendation successfully', { topic });
      return true;
    } catch (err) {
      logger.error('Failed to publish soil recommendation', err);
      return false;
    }
  }

  /**
   * Publishes recommendation payload to water quality device recommendation topic.
   */
  public async publishWaterRecommendation(payload: Record<string, unknown>): Promise<boolean> {
    if (!this.mqttClient) {
      logger.warn('Cannot publish water recommendation: MQTT client not bound');
      return false;
    }

    try {
      const topic = this.getWaterRecommendationTopic();
      const json = JSON.stringify(payload);
      await this.mqttClient.publish(topic, json, 1, false);
      logger.info('Published water recommendation successfully', { topic });
      return true;
    } catch (err) {
      logger.error('Failed to publish water recommendation', err);
      return false;
    }
  }
}

export const soilWaterMqttAdapter = new SoilWaterMqttAdapter();
