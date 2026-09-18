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
  ExternalPredictionClient,
  getExternalPredictionClient,
  buildOutboundRecommendationPayload,
} from '@kebun-melon/database';
import {
  DeviceType,
  MonitoringStatus,
  SoilTelemetryDataSchema,
  WaterTelemetryDataSchema,
  SoilPredictionDto,
  WaterPredictionDto,
  OutboundRecommendationPayload,
} from '@kebun-melon/contracts';

export const SOIL_WATER_TOPICS = {
  SOIL_DATA: 'melon/sensor-tanah/data-2424600050',
  SOIL_RECOMMENDATION: 'melon/ai-tanah/rekomendasi-2424600050',
  WATER_DATA: 'melon/sensor-air/data-2424600050',
  WATER_RECOMMENDATION: 'melon/ai-air/rekomendasi-2424600050',
} as const;

export interface SoilWaterAdapterOptions {
  env?: GatewayEnv;
  mqttClient?: GatewayMqttClient;
  telemetryRepo?: TelemetryRepository;
  deviceRepo?: DeviceRepository;
  predictionClient?: ExternalPredictionClient;
  allowAliasFallback?: boolean;
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
  private predictionClient: ExternalPredictionClient | null = null;
  private allowAliasFallback = false;
  private unsubscribeFn: (() => void) | null = null;
  private isSubscribed = false;
  private deviceCache = new Map<string, { deviceId: string; id: string; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 30000;
  private lastPublishedPredictionIds = new Map<string, string>();
  private recommendationDebounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(options: SoilWaterAdapterOptions = {}) {
    this.env = options.env || null;
    this.mqttClient = options.mqttClient || null;
    this.telemetryRepo = options.telemetryRepo || null;
    this.deviceRepo = options.deviceRepo || null;
    this.predictionClient = options.predictionClient || null;
    this.allowAliasFallback = options.allowAliasFallback ?? false;
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
    deviceRepo?: DeviceRepository,
    predictionClient?: ExternalPredictionClient
  ): void {
    this.env = env;
    this.mqttClient = mqttClient;
    if (telemetryRepo) this.telemetryRepo = telemetryRepo;
    if (deviceRepo) this.deviceRepo = deviceRepo;
    if (predictionClient) this.predictionClient = predictionClient;
  }

  public setPredictionClient(client: ExternalPredictionClient | null): void {
    this.predictionClient = client;
  }

  public setAllowAliasFallback(allow: boolean): void {
    this.allowAliasFallback = allow;
  }

  public clearPublishedHistory(): void {
    this.lastPublishedPredictionIds.clear();
  }

  public clearDebounceTimers(): void {
    for (const timer of this.recommendationDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.recommendationDebounceTimers.clear();
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
    this.clearDebounceTimers();
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

        // TASK-0413 Phase C: Asynchronously dispatch outbound AI recommendation without blocking telemetry ingestion
        this.triggerRecommendationDispatch({
          deviceDbId: result.deviceId,
          canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
          clientId: normalized.clientId || targetDeviceId,
          domain: 'SOIL',
          recordedAt: normalized.recordedAt,
        }).catch((err) => {
          logger.error('Unhandled background soil recommendation dispatch error', err, {
            deviceId: targetDeviceId,
          });
        });
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

        // TASK-0413 Phase C: Asynchronously dispatch outbound AI recommendation without blocking telemetry ingestion
        this.triggerRecommendationDispatch({
          deviceDbId: result.deviceId,
          canonicalDeviceId: result.canonicalDeviceId || targetDeviceId,
          clientId: normalized.clientId || targetDeviceId,
          domain: 'WATER',
          recordedAt: normalized.recordedAt,
        }).catch((err) => {
          logger.error('Unhandled background water recommendation dispatch error', err, {
            deviceId: targetDeviceId,
          });
        });
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
   * Asynchronously schedules recommendation retrieval and dispatch.
   * Uses configurable debounce (default 1500ms pending confirmed pipeline latency) before querying external ML.
   */
  public async triggerRecommendationDispatch(params: {
    deviceDbId: string;
    canonicalDeviceId: string;
    clientId: string;
    domain: 'SOIL' | 'WATER';
    recordedAt?: string | null;
  }): Promise<void> {
    if (this.env?.EXTERNAL_ML_RECOMMENDATION_ENABLED === false) {
      return;
    }

    const debounceMs = this.env?.EXTERNAL_ML_DEBOUNCE_MS ?? 1500;
    const debounceKey = `${params.canonicalDeviceId}:${params.domain}`;

    if (debounceMs <= 0) {
      await this.executeRecommendationDispatch(params);
      return;
    }

    const existing = this.recommendationDebounceTimers.get(debounceKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.recommendationDebounceTimers.delete(debounceKey);
      try {
        await this.executeRecommendationDispatch(params);
      } catch (err) {
        logger.error('Error executing delayed recommendation dispatch', err, {
          deviceId: params.canonicalDeviceId,
          domain: params.domain,
        });
      }
    }, debounceMs);

    this.recommendationDebounceTimers.set(debounceKey, timer);
  }

  /**
   * Executes prediction retrieval and MQTT recommendation publishing.
   * Invariants:
   * 1. Resolves externalDeviceId dynamically from Melon's device_external_mappings.
   * 2. Rejects unmapped devices fail-closed in production (no hardcoded fallback).
   * 3. Queries ExternalPredictionClient with timeout and forceRefresh.
   * 4. Validates freshness against EXTERNAL_ML_MAX_STALENESS_SECONDS.
   * 5. Prevents duplicate publishing if prediction ID was already dispatched.
   * 6. Dispatches to recommendation topic with QoS 1, retain: false.
   * 7. Remains strictly advisory: zero actuation or command triggers.
   */
  public async executeRecommendationDispatch(params: {
    deviceDbId: string;
    canonicalDeviceId: string;
    clientId: string;
    domain: 'SOIL' | 'WATER';
    recordedAt?: string | null;
  }): Promise<{ published: boolean; reason?: string; predictionId?: string }> {
    if (!this.deviceRepo) {
      logger.warn('DeviceRepository not available for recommendation dispatch');
      return { published: false, reason: 'DEVICE_REPO_UNAVAILABLE' };
    }

    // 1. Resolve active external device ID from database
    const activeExternalId = await this.deviceRepo.getActiveExternalDeviceId(
      params.deviceDbId,
      params.domain,
      'EXTERNAL_ML'
    );

    let targetExternalId: string | null = activeExternalId;

    if (!targetExternalId) {
      const isProduction =
        this.env?.APP_ENV === 'production' || process.env.NODE_ENV === 'production';

      if (this.allowAliasFallback && !isProduction) {
        targetExternalId = params.canonicalDeviceId;
      } else {
        logger.warn('Skipping recommendation publish: no active external ML mapping in database', {
          deviceId: params.canonicalDeviceId,
          domain: params.domain,
        });
        return { published: false, reason: 'NO_ACTIVE_EXTERNAL_MAPPING' };
      }
    }

    // 2. Query ExternalPredictionClient
    const client =
      this.predictionClient ||
      (this.env?.EXTERNAL_ML_SUPABASE_URL
        ? new ExternalPredictionClient({
            supabaseUrl: this.env.EXTERNAL_ML_SUPABASE_URL,
            supabaseKey:
              this.env.EXTERNAL_ML_SUPABASE_SECRET_KEY ||
              this.env.EXTERNAL_ML_SUPABASE_PUBLISHABLE_KEY,
            timeoutMs: this.env.EXTERNAL_ML_TIMEOUT_MS,
          })
        : getExternalPredictionClient(process.env));

    if (!client || !client.isConfigured()) {
      logger.warn('Skipping recommendation publish: ExternalPredictionClient not configured', {
        domain: params.domain,
      });
      return { published: false, reason: 'PREDICTION_CLIENT_NOT_CONFIGURED' };
    }

    let prediction: SoilPredictionDto | WaterPredictionDto | null = null;
    try {
      if (params.domain === 'SOIL') {
        prediction = await client.getLatestSoilPrediction(targetExternalId, { forceRefresh: true });
      } else {
        prediction = await client.getLatestWaterPrediction(targetExternalId, {
          forceRefresh: true,
        });
      }
    } catch (err: any) {
      logger.error('Failed to fetch prediction from external ML service', err, {
        domain: params.domain,
        targetExternalId,
      });
      return { published: false, reason: 'FETCH_ERROR' };
    }

    if (!prediction) {
      logger.info('No prediction available from external ML service', {
        domain: params.domain,
        targetExternalId,
      });
      return { published: false, reason: 'PREDICTION_UNAVAILABLE' };
    }

    // 3. Validate prediction freshness
    const maxStalenessMs = (this.env?.EXTERNAL_ML_MAX_STALENESS_SECONDS ?? 300) * 1000;
    const predCreatedAt = new Date(prediction.createdAt).getTime();

    if (isNaN(predCreatedAt)) {
      logger.warn('Skipping recommendation publish: invalid prediction createdAt timestamp', {
        predictionId: prediction.id,
        createdAt: prediction.createdAt,
      });
      return { published: false, reason: 'INVALID_TIMESTAMP' };
    }

    if (Date.now() - predCreatedAt > maxStalenessMs) {
      logger.warn('Skipping recommendation publish: prediction is stale', {
        predictionId: prediction.id,
        createdAt: prediction.createdAt,
        ageSeconds: Math.round((Date.now() - predCreatedAt) / 1000),
      });
      return { published: false, reason: 'PREDICTION_STALE' };
    }

    // 4. Prevent duplicate publish of identical prediction ID
    const dedupeKey = `${params.canonicalDeviceId}:${params.domain}`;
    if (prediction.id && this.lastPublishedPredictionIds.get(dedupeKey) === prediction.id) {
      logger.info('Skipping recommendation publish: duplicate prediction ID already published', {
        predictionId: prediction.id,
        deviceId: params.canonicalDeviceId,
      });
      return { published: false, reason: 'DUPLICATE_PREDICTION', predictionId: prediction.id };
    }

    // 5. Build canonical outbound recommendation payload
    let outboundPayload: OutboundRecommendationPayload;
    try {
      outboundPayload = buildOutboundRecommendationPayload({
        prediction,
        domain: params.domain,
        clientId: params.clientId,
        canonicalDeviceId: params.canonicalDeviceId,
      });
    } catch (err: any) {
      logger.error('Failed to construct OutboundRecommendationPayload schema', err, {
        predictionId: prediction.id,
      });
      return { published: false, reason: 'PAYLOAD_VALIDATION_FAILED' };
    }

    // 6. Publish to topic with QoS 1 and retain: false
    let published = false;
    if (params.domain === 'SOIL') {
      published = await this.publishSoilRecommendation(outboundPayload);
    } else {
      published = await this.publishWaterRecommendation(outboundPayload);
    }

    if (published) {
      if (prediction.id) {
        this.lastPublishedPredictionIds.set(dedupeKey, prediction.id);
      }
      logger.info('Dispatched outbound AI recommendation successfully via MQTT', {
        topic:
          params.domain === 'SOIL'
            ? this.getSoilRecommendationTopic()
            : this.getWaterRecommendationTopic(),
        predictionId: prediction.id,
        deviceId: params.canonicalDeviceId,
        domain: params.domain,
        predictedClass: prediction.predictedClass,
      });
      return { published: true, predictionId: prediction.id ?? undefined };
    }

    return { published: false, reason: 'PUBLISH_FAILED' };
  }

  /**
   * Publishes recommendation payload to soil device recommendation topic.
   */
  public async publishSoilRecommendation(
    payload: Record<string, unknown>,
    customTopic?: string
  ): Promise<boolean> {
    if (!this.mqttClient) {
      logger.warn('Cannot publish soil recommendation: MQTT client not bound');
      return false;
    }

    try {
      const topic = customTopic || this.getSoilRecommendationTopic();
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
  public async publishWaterRecommendation(
    payload: Record<string, unknown>,
    customTopic?: string
  ): Promise<boolean> {
    if (!this.mqttClient) {
      logger.warn('Cannot publish water recommendation: MQTT client not bound');
      return false;
    }

    try {
      const topic = customTopic || this.getWaterRecommendationTopic();
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
