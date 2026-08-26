import mqtt from 'mqtt';
import { getMqttSimulatorCredentials } from './mqtt-config';
import {
  SoilTelemetryPayload,
  WaterTelemetryPayload,
  ReservoirTelemetryPayload,
  SoilTelemetryData,
  WaterTelemetryData,
  ReservoirTelemetryData,
  FaucetAckReasonCode,
  FAUCET_ACK_REASON_CODES,
  FAUCET_PRESET_VOLUMES,
} from '@kebun-melon/contracts';

export interface DeviceSimulatorConfig {
  environment?: 'development' | 'staging' | 'production';
  siteId?: string;
  deviceId?: string;
  soilDeviceId?: string;
  waterDeviceId?: string;
  tankDeviceId?: string;
  apiBaseUrl?: string;
  brokerUrl?: string;
  username?: string;
  password?: string;
}

export interface FaucetCommandPayload {
  schemaVersion: string;
  commandId: string;
  deviceId: string;
  siteId?: string | null;
  action: 'DISPENSE';
  phase: number;
  targetVolumeMl: number;
  requestedAt: string;
  expiresAt: string;
}

export interface ScenarioResult {
  scenario: string;
  simulated: boolean;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Multi-Device Operational Simulator (TASK-0408)
 *
 * Implements simulator capabilities per approved contracts:
 * - Soil Telemetry Ingestion via REST API over Wi-Fi (TASK-0405, DEC-DEV-020, DEC-MON-086, SOIL_NODE).
 * - Water Quality Telemetry Ingestion via REST API over Wi-Fi (TASK-0406, DEC-DEV-020, DEC-MON-086, WATER_QUALITY_NODE).
 * - Reservoir Water Telemetry Ingestion via MQTT 5.0/TLS (WATER_TANK_NODE, DEC-DEV-020).
 * - Faucet Command ACK, Progress, Completion, and Failure via MQTT (DEC-CTRL-051, WATER_TANK_NODE).
 * - Duplicate, Invalid Payload, Out-of-Order, and Disconnect/Reconnect Simulation.
 * - Explicitly blocks Heartbeat (TASK-0407) and Timeout (TASK-0809) simulations due to TBD thresholds.
 */
export class DeviceSimulator {
  public readonly config: Required<DeviceSimulatorConfig>;
  private client: mqtt.MqttClient | null = null;
  private sequence = 1;

  constructor(config?: DeviceSimulatorConfig) {
    let creds = {
      brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username: process.env.MQTT_STAGING_USERNAME || process.env.MQTT_DEV1_USERNAME || 'dev_user_1',
      password: process.env.MQTT_STAGING_PASSWORD || process.env.MQTT_DEV1_PASSWORD || 'dev_pass_1',
      deviceId: process.env.MQTT_DEVICE_ID || 'esp32-001',
    };
    try {
      creds = getMqttSimulatorCredentials();
    } catch {
      // Graceful fallback when running in environment without local .env credential keys
    }

    const envVar =
      process.env.MQTT_ENVIRONMENT ||
      process.env.APP_ENV ||
      (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    const validEnv: 'development' | 'staging' | 'production' =
      envVar === 'development' || envVar === 'staging' || envVar === 'production'
        ? envVar
        : 'development';

    const defaultDeviceId = config?.deviceId || creds.deviceId;

    this.config = {
      environment: config?.environment || validEnv,
      siteId: config?.siteId || process.env.MQTT_SITE_ID || 'site-01',
      deviceId: defaultDeviceId || '',
      soilDeviceId:
        config?.soilDeviceId !== undefined
          ? config.soilDeviceId || undefined
          : process.env.MQTT_SOIL_DEVICE_ID ||
            process.env.SOIL_DEVICE_ID ||
            (defaultDeviceId && this.isSoilDevice(defaultDeviceId) ? defaultDeviceId : undefined),
      waterDeviceId:
        config?.waterDeviceId !== undefined
          ? config.waterDeviceId || undefined
          : process.env.MQTT_WATER_DEVICE_ID ||
            process.env.WATER_DEVICE_ID ||
            (defaultDeviceId && this.isWaterQualityDevice(defaultDeviceId)
              ? defaultDeviceId
              : undefined),
      tankDeviceId:
        config?.tankDeviceId !== undefined
          ? config.tankDeviceId || undefined
          : process.env.MQTT_TANK_DEVICE_ID ||
            (defaultDeviceId && this.isTankDevice(defaultDeviceId)
              ? defaultDeviceId
              : config?.deviceId
                ? config.deviceId
                : process.env.MQTT_DEVICE_ID || creds.deviceId || undefined),
      apiBaseUrl: config?.apiBaseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      brokerUrl: config?.brokerUrl || creds.brokerUrl,
      username: config?.username || creds.username,
      password: config?.password || creds.password,
    };
  }

  private isSoilDevice(id: string): boolean {
    return id.toLowerCase().includes('soil');
  }

  private isWaterQualityDevice(id: string): boolean {
    const lower = id.toLowerCase();
    return lower.includes('water') && !lower.includes('tank');
  }

  private isTankDevice(id: string): boolean {
    const lower = id.toLowerCase();
    return lower.includes('tank');
  }

  /**
   * Resolves device ID for Soil Telemetry domain (SOIL_NODE).
   */
  public getSoilDeviceId(overrideId?: string, allowIncompatible = false): string {
    const selected = overrideId || this.config.soilDeviceId;

    if (!selected) {
      throw new Error(
        `[DeviceSimulator] Missing registered SOIL_NODE device configuration. Provide a registered SOIL_NODE device ID via --soil-device-id, --device-id, or SOIL_DEVICE_ID / MQTT_SOIL_DEVICE_ID environment variable.`
      );
    }

    if (
      !allowIncompatible &&
      overrideId &&
      (this.isTankDevice(overrideId) || this.isWaterQualityDevice(overrideId))
    ) {
      throw new Error(
        `[DeviceSimulator] Incompatible device ID '${overrideId}' for Soil Telemetry simulation. Soil Telemetry requires a SOIL_NODE device.`
      );
    }

    return selected;
  }

  /**
   * Resolves device ID for Water Quality Telemetry domain (WATER_QUALITY_NODE).
   */
  public getWaterDeviceId(overrideId?: string, allowIncompatible = false): string {
    const selected = overrideId || this.config.waterDeviceId;

    if (!selected) {
      throw new Error(
        `[DeviceSimulator] Missing registered WATER_QUALITY_NODE device configuration. Provide a registered WATER_QUALITY_NODE device ID via --water-device-id, --device-id, or WATER_DEVICE_ID / MQTT_WATER_DEVICE_ID environment variable.`
      );
    }

    if (
      !allowIncompatible &&
      overrideId &&
      (this.isTankDevice(overrideId) || this.isSoilDevice(overrideId))
    ) {
      throw new Error(
        `[DeviceSimulator] Incompatible device ID '${overrideId}' for Water Quality Telemetry simulation. Water Quality Telemetry requires a WATER_QUALITY_NODE device.`
      );
    }

    return selected;
  }

  /**
   * Resolves device ID for Reservoir / Faucet domain (WATER_TANK_NODE).
   */
  public getTankDeviceId(overrideId?: string, allowIncompatible = false): string {
    const selected = overrideId || this.config.tankDeviceId;

    if (!selected) {
      throw new Error(
        `[DeviceSimulator] Missing registered WATER_TANK_NODE device configuration. Provide a registered WATER_TANK_NODE device ID via --tank-device-id, --device-id, or MQTT_TANK_DEVICE_ID / MQTT_DEVICE_ID environment variable.`
      );
    }

    if (
      !allowIncompatible &&
      overrideId &&
      (this.isSoilDevice(overrideId) || this.isWaterQualityDevice(overrideId))
    ) {
      throw new Error(
        `[DeviceSimulator] Incompatible device ID '${overrideId}' for Reservoir/Faucet simulation. Reservoir/Faucet scenarios require a WATER_TANK_NODE device.`
      );
    }

    return selected;
  }

  /**
   * Generates canonical Soil Telemetry payload (REST API over Wi-Fi).
   * Note: BAT parameter is omitted per DEC-MON-086.
   * Target device ID uses SOIL_NODE domain resolution.
   */
  public buildSoilTelemetryPayload(
    customData?: Partial<SoilTelemetryData>,
    payloadOverrides?: Partial<SoilTelemetryPayload>,
    allowIncompatibleDevice = false
  ): SoilTelemetryPayload {
    const seq = payloadOverrides?.sequence ?? this.sequence++;
    const now = new Date().toISOString();
    const targetDeviceId = payloadOverrides?.deviceId
      ? this.getSoilDeviceId(payloadOverrides.deviceId, allowIncompatibleDevice)
      : this.getSoilDeviceId(undefined, allowIncompatibleDevice);

    return {
      schemaVersion: '1.0',
      messageId: payloadOverrides?.messageId || `msg-soil-${Date.now()}-${seq}`,
      siteId: payloadOverrides?.siteId !== undefined ? payloadOverrides.siteId : this.config.siteId,
      sequence: seq,
      recordedAt: payloadOverrides?.recordedAt || now,
      timestamp: payloadOverrides?.timestamp || now,
      data: {
        nitrogen: 45.2,
        phosphorus: 21.8,
        potassium: 73.1,
        temperature: 28.4,
        moisture: 67.3,
        ph: 6.5,
        ec: 1.42,
        status: 'NORMAL',
        ...customData,
      },
      ...payloadOverrides,
      deviceId: targetDeviceId,
    };
  }

  /**
   * Sends Soil Telemetry reading over REST API.
   * Consumes response stream at most once to prevent TypeError: Body is unusable on failure.
   */
  public async sendSoilTelemetry(
    customData?: Partial<SoilTelemetryData>,
    payloadOverrides?: Partial<SoilTelemetryPayload>
  ): Promise<{ ok: boolean; status: number; body: unknown; payload: SoilTelemetryPayload }> {
    const payload = this.buildSoilTelemetryPayload(customData, payloadOverrides);
    const targetUrl = `${this.config.apiBaseUrl}/api/v1/devices/${payload.deviceId}/telemetry/soil`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': payload.deviceId,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: unknown = text;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { ok: response.ok, status: response.status, body, payload };
  }

  /**
   * Generates canonical Water Quality Telemetry payload (REST API over Wi-Fi).
   * Note: BAT, latitude, and longitude parameters are omitted per DEC-MON-086.
   * Target device ID uses WATER_QUALITY_NODE domain resolution.
   */
  public buildWaterTelemetryPayload(
    customData?: Partial<WaterTelemetryData>,
    payloadOverrides?: Partial<WaterTelemetryPayload>,
    allowIncompatibleDevice = false
  ): WaterTelemetryPayload {
    const seq = payloadOverrides?.sequence ?? this.sequence++;
    const now = new Date().toISOString();
    const targetDeviceId = this.getWaterDeviceId(
      payloadOverrides?.deviceId,
      allowIncompatibleDevice
    );

    return {
      schemaVersion: '1.0',
      messageId: payloadOverrides?.messageId || `msg-water-${Date.now()}-${seq}`,
      siteId: payloadOverrides?.siteId !== undefined ? payloadOverrides.siteId : this.config.siteId,
      sequence: seq,
      recordedAt: payloadOverrides?.recordedAt || now,
      timestamp: payloadOverrides?.timestamp || now,
      data: {
        ph: 7.1,
        tds: 420,
        ec: 0.84,
        status: 'NORMAL',
        ...customData,
      },
      ...payloadOverrides,
      deviceId: targetDeviceId,
    };
  }

  /**
   * Sends Water Quality Telemetry reading over REST API.
   * Consumes response stream at most once to prevent TypeError: Body is unusable on failure.
   */
  public async sendWaterTelemetry(
    customData?: Partial<WaterTelemetryData>,
    payloadOverrides?: Partial<WaterTelemetryPayload>
  ): Promise<{ ok: boolean; status: number; body: unknown; payload: WaterTelemetryPayload }> {
    const payload = this.buildWaterTelemetryPayload(customData, payloadOverrides);
    const targetUrl = `${this.config.apiBaseUrl}/api/v1/devices/${payload.deviceId}/telemetry/water`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': payload.deviceId,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: unknown = text;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { ok: response.ok, status: response.status, body, payload };
  }

  /**
   * Generates canonical Reservoir Telemetry payload (MQTT over TLS).
   * Target device ID uses WATER_TANK_NODE domain resolution.
   */
  public buildReservoirTelemetryPayload(
    customData?: Partial<ReservoirTelemetryData>,
    payloadOverrides?: Partial<ReservoirTelemetryPayload>,
    allowIncompatibleDevice = false
  ): ReservoirTelemetryPayload {
    const seq = payloadOverrides?.sequence ?? this.sequence++;
    const now = new Date().toISOString();
    const targetDeviceId = this.getTankDeviceId(
      payloadOverrides?.deviceId,
      allowIncompatibleDevice
    );

    return {
      schemaVersion: '1.0',
      messageId: payloadOverrides?.messageId || `msg-reservoir-${Date.now()}-${seq}`,
      siteId: payloadOverrides?.siteId !== undefined ? payloadOverrides.siteId : this.config.siteId,
      sequence: seq,
      recordedAt: payloadOverrides?.recordedAt || now,
      sentAt: payloadOverrides?.sentAt || now,
      firmwareVersion: payloadOverrides?.firmwareVersion || '1.0.0',
      data: {
        tankVolume: 75.0,
        flowRate: 2.3,
        status: 'NORMAL',
        ...customData,
      },
      ...payloadOverrides,
      deviceId: targetDeviceId,
    };
  }

  /**
   * Establishes MQTT connection if not connected.
   */
  public async connectMqtt(): Promise<mqtt.MqttClient> {
    if (this.client && this.client.connected) {
      return this.client;
    }

    const clientId = `sim-${this.getTankDeviceId()}-${Math.random().toString(16).substring(2, 8)}`;
    const isWebSocket =
      this.config.brokerUrl.startsWith('ws://') || this.config.brokerUrl.startsWith('wss://');

    this.client = mqtt.connect(this.config.brokerUrl, {
      username: this.config.username,
      password: this.config.password,
      clientId,
      clean: true,
      reconnectPeriod: 2000,
      rejectUnauthorized: true,
      ...(isWebSocket ? { path: '/mqtt' } : {}),
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.client) this.client.end(true);
        reject(new Error(`[${this.getTankDeviceId()} Simulator] MQTT connection timeout`));
      }, 10000);

      this.client.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        if (this.client) this.client.end(true);
        reject(err);
      });
    });

    return this.client;
  }

  /**
   * Publishes Reservoir Telemetry payload over MQTT.
   */
  public async publishReservoirTelemetry(
    customData?: Partial<ReservoirTelemetryData>,
    payloadOverrides?: Partial<ReservoirTelemetryPayload>
  ): Promise<{ topic: string; payload: ReservoirTelemetryPayload }> {
    const client = await this.connectMqtt();
    const payload = this.buildReservoirTelemetryPayload(customData, payloadOverrides);
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${payload.deviceId}/telemetry/reservoir`;

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return { topic, payload };
  }

  /**
   * Publishes raw string or JSON message over MQTT.
   */
  public async publishRawMqtt(
    topic: string,
    message: string | unknown,
    options: mqtt.IClientPublishOptions = { qos: 1, retain: false }
  ): Promise<void> {
    const client = await this.connectMqtt();
    const payloadString = typeof message === 'string' ? message : JSON.stringify(message);

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payloadString, options, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Listens for Faucet Control commands targeted at this simulator device (WATER_TANK_NODE).
   */
  public async listenFaucetCommands(
    handler: (command: FaucetCommandPayload) => void | Promise<void>
  ): Promise<void> {
    const client = await this.connectMqtt();
    const tankId = this.getTankDeviceId();
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/command/faucet`;

    await new Promise<void>((resolve, reject) => {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client.on('message', (receivedTopic, payloadBuffer) => {
      if (receivedTopic === topic) {
        try {
          const parsed = JSON.parse(payloadBuffer.toString()) as FaucetCommandPayload;
          handler(parsed);
        } catch (err) {
          console.error(`[${tankId} Simulator] Invalid command JSON received:`, err);
        }
      }
    });
  }

  /**
   * Publishes Faucet Command Acknowledgement (ACKNOWLEDGED or REJECTED) over MQTT.
   */
  public async sendFaucetAck(
    commandId: string,
    accepted: boolean,
    reasonCode?: FaucetAckReasonCode | string
  ): Promise<{ topic: string; payload: unknown }> {
    const tankId = this.getTankDeviceId();
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/ack/faucet`;
    const payload = {
      schemaVersion: '1.0',
      messageId: `ack-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      commandId,
      deviceId: tankId,
      recordedAt: new Date().toISOString(),
      data: {
        status: accepted ? 'ACKNOWLEDGED' : 'REJECTED',
        accepted,
        ...(reasonCode ? { reasonCode } : {}),
      },
    };

    await this.publishRawMqtt(topic, payload, { qos: 1, retain: false });
    return { topic, payload };
  }

  /**
   * Publishes Faucet Progress Event over MQTT.
   */
  public async sendFaucetProgress(
    commandId: string,
    actualVolumeMl: number
  ): Promise<{ topic: string; payload: unknown }> {
    const tankId = this.getTankDeviceId();
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/event/faucet`;
    const payload = {
      schemaVersion: '1.0',
      messageId: `event-progress-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      commandId,
      deviceId: tankId,
      recordedAt: new Date().toISOString(),
      data: {
        status: 'IN_PROGRESS',
        actualVolumeMl,
      },
    };

    await this.publishRawMqtt(topic, payload, { qos: 0, retain: false });
    return { topic, payload };
  }

  /**
   * Publishes Faucet Completion Event over MQTT.
   */
  public async sendFaucetCompletion(
    commandId: string,
    targetVolumeMl: number,
    actualVolumeMl: number
  ): Promise<{ topic: string; payload: unknown }> {
    const tankId = this.getTankDeviceId();
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/event/faucet`;
    const payload = {
      schemaVersion: '1.0',
      messageId: `event-completed-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      commandId,
      deviceId: tankId,
      recordedAt: new Date().toISOString(),
      data: {
        status: 'COMPLETED',
        targetVolumeMl,
        actualVolumeMl,
      },
    };

    await this.publishRawMqtt(topic, payload, { qos: 1, retain: false });
    return { topic, payload };
  }

  /**
   * Publishes Faucet Failure Event over MQTT.
   */
  public async sendFaucetFailure(
    commandId: string,
    reasonCode: string
  ): Promise<{ topic: string; payload: unknown }> {
    const tankId = this.getTankDeviceId();
    const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/event/faucet`;
    const payload = {
      schemaVersion: '1.0',
      messageId: `event-failed-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      commandId,
      deviceId: tankId,
      recordedAt: new Date().toISOString(),
      data: {
        status: 'FAILED',
        reasonCode,
      },
    };

    await this.publishRawMqtt(topic, payload, { qos: 1, retain: false });
    return { topic, payload };
  }

  /**
   * Simulates full Faucet Dispense Lifecycle: ACK -> IN_PROGRESS -> COMPLETED
   */
  public async runFaucetDispenseLifecycleScenario(
    commandId: string,
    targetVolumeMl: number
  ): Promise<ScenarioResult> {
    try {
      await this.sendFaucetAck(commandId, true);
      const halfVolume = Math.round(targetVolumeMl / 2);
      await this.sendFaucetProgress(commandId, halfVolume);
      await this.sendFaucetCompletion(commandId, targetVolumeMl, targetVolumeMl + 2);

      return {
        scenario: 'faucet-dispense-lifecycle',
        simulated: true,
        status: 'SUCCESS',
        message: `Successfully simulated Faucet Dispense Lifecycle for command '${commandId}' (${targetVolumeMl} mL).`,
        details: { commandId, targetVolumeMl },
      };
    } catch (err) {
      return {
        scenario: 'faucet-dispense-lifecycle',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate Faucet Dispense Lifecycle: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates Faucet Command Rejection (e.g. DEVICE_BUSY, INVALID_PHASE, CONTROL_DISABLED)
   */
  public async runFaucetRejectionScenario(
    commandId: string,
    reasonCode: FaucetAckReasonCode | string = 'DEVICE_BUSY'
  ): Promise<ScenarioResult> {
    try {
      await this.sendFaucetAck(commandId, false, reasonCode);
      return {
        scenario: 'faucet-rejection',
        simulated: true,
        status: 'SUCCESS',
        message: `Successfully simulated Faucet Command Rejection for command '${commandId}' with reason '${reasonCode}'.`,
        details: { commandId, reasonCode },
      };
    } catch (err) {
      return {
        scenario: 'faucet-rejection',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate Faucet Command Rejection: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates Faucet Command Failure (ACKNOWLEDGED -> FAILED)
   */
  public async runFaucetFailureScenario(
    commandId: string,
    reasonCode = 'FLOW_NOT_DETECTED'
  ): Promise<ScenarioResult> {
    try {
      await this.sendFaucetAck(commandId, true);
      await this.sendFaucetFailure(commandId, reasonCode);
      return {
        scenario: 'faucet-failure',
        simulated: true,
        status: 'SUCCESS',
        message: `Successfully simulated Faucet Command Failure for command '${commandId}' with reason '${reasonCode}'.`,
        details: { commandId, reasonCode },
      };
    } catch (err) {
      return {
        scenario: 'faucet-failure',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate Faucet Command Failure: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates Duplicate Payload scenarios (re-transmitting same messageId).
   */
  public async runDuplicatePayloadScenario(
    type: 'soil' | 'water' | 'reservoir',
    fixedMessageId = `msg-dup-${Date.now()}`
  ): Promise<ScenarioResult> {
    try {
      if (type === 'soil') {
        const payload1 = await this.sendSoilTelemetry({}, { messageId: fixedMessageId });
        const payload2 = await this.sendSoilTelemetry({}, { messageId: fixedMessageId });
        return {
          scenario: 'duplicate-payload',
          simulated: true,
          status: 'SUCCESS',
          message: `Sent duplicate Soil Telemetry payloads with messageId '${fixedMessageId}'.`,
          details: {
            firstStatus: payload1.status,
            secondStatus: payload2.status,
            messageId: fixedMessageId,
          },
        };
      } else if (type === 'water') {
        const payload1 = await this.sendWaterTelemetry({}, { messageId: fixedMessageId });
        const payload2 = await this.sendWaterTelemetry({}, { messageId: fixedMessageId });
        return {
          scenario: 'duplicate-payload',
          simulated: true,
          status: 'SUCCESS',
          message: `Sent duplicate Water Quality Telemetry payloads with messageId '${fixedMessageId}'.`,
          details: {
            firstStatus: payload1.status,
            secondStatus: payload2.status,
            messageId: fixedMessageId,
          },
        };
      } else {
        await this.publishReservoirTelemetry({}, { messageId: fixedMessageId });
        await this.publishReservoirTelemetry({}, { messageId: fixedMessageId });
        return {
          scenario: 'duplicate-payload',
          simulated: true,
          status: 'SUCCESS',
          message: `Published duplicate Reservoir Telemetry MQTT payloads with messageId '${fixedMessageId}'.`,
          details: { messageId: fixedMessageId },
        };
      }
    } catch (err) {
      return {
        scenario: 'duplicate-payload',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate duplicate payload: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates Invalid Payload scenarios (malformed JSON, missing fields, NaN/Infinity, device mismatch, oversized).
   */
  public async runInvalidPayloadScenario(
    type: 'soil' | 'water' | 'reservoir',
    anomaly:
      | 'INVALID_JSON'
      | 'MISSING_FIELD'
      | 'NON_FINITE_NUMBER'
      | 'TOPIC_DEVICE_MISMATCH'
      | 'OVERSIZED_PAYLOAD'
  ): Promise<ScenarioResult> {
    try {
      if (type === 'reservoir') {
        const tankId = this.getTankDeviceId();
        const topic = `agriculture/${this.config.environment}/${this.config.siteId}/${tankId}/telemetry/reservoir`;
        let invalidMessage: string | object = '';

        switch (anomaly) {
          case 'INVALID_JSON':
            invalidMessage = '{"schemaVersion": "1.0", "messageId": "msg-broken", ';
            break;
          case 'MISSING_FIELD':
            invalidMessage = { schemaVersion: '1.0', deviceId: tankId }; // missing messageId and data
            break;
          case 'NON_FINITE_NUMBER':
            invalidMessage = {
              schemaVersion: '1.0',
              messageId: `msg-nan-${Date.now()}`,
              deviceId: tankId,
              data: { tankVolume: 'NaN', flowRate: Infinity },
            };
            break;
          case 'TOPIC_DEVICE_MISMATCH':
            invalidMessage = this.buildReservoirTelemetryPayload(
              {},
              { deviceId: 'mismatched-device-999' },
              true
            );
            break;
          case 'OVERSIZED_PAYLOAD':
            invalidMessage = {
              schemaVersion: '1.0',
              messageId: `msg-huge-${Date.now()}`,
              deviceId: tankId,
              data: { padding: 'X'.repeat(70000) },
            };
            break;
        }

        await this.publishRawMqtt(topic, invalidMessage);
        return {
          scenario: `invalid-payload-${anomaly.toLowerCase()}`,
          simulated: true,
          status: 'SUCCESS',
          message: `Published invalid reservoir MQTT payload (${anomaly}).`,
          details: { anomaly },
        };
      } else {
        // REST Soil or Water
        const targetRoute = type === 'soil' ? 'soil' : 'water';
        const targetDeviceId = type === 'soil' ? this.getSoilDeviceId() : this.getWaterDeviceId();
        const url = `${this.config.apiBaseUrl}/api/v1/devices/${targetDeviceId}/telemetry/${targetRoute}`;

        let invalidBody = '';
        switch (anomaly) {
          case 'INVALID_JSON':
            invalidBody = '{"schemaVersion":"1.0", "deviceId": "broken';
            break;
          case 'MISSING_FIELD':
            invalidBody = JSON.stringify({ schemaVersion: '1.0', deviceId: targetDeviceId });
            break;
          case 'NON_FINITE_NUMBER':
            invalidBody = JSON.stringify({
              schemaVersion: '1.0',
              messageId: `msg-nan-${Date.now()}`,
              deviceId: targetDeviceId,
              data: { ph: 'INVALID_NUM' },
            });
            break;
          case 'TOPIC_DEVICE_MISMATCH':
            invalidBody = JSON.stringify(
              type === 'soil'
                ? this.buildSoilTelemetryPayload({}, { deviceId: 'mismatched-device-999' }, true)
                : this.buildWaterTelemetryPayload({}, { deviceId: 'mismatched-device-999' }, true)
            );
            break;
          case 'OVERSIZED_PAYLOAD':
            invalidBody = JSON.stringify({
              schemaVersion: '1.0',
              messageId: `msg-huge-${Date.now()}`,
              deviceId: targetDeviceId,
              padding: 'X'.repeat(70000),
            });
            break;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: invalidBody,
        });

        const text = await res.text();
        let body: unknown = text;
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
        }

        return {
          scenario: `invalid-payload-${anomaly.toLowerCase()}`,
          simulated: true,
          status: 'SUCCESS',
          message: `Sent invalid ${type} REST payload (${anomaly}). Response HTTP ${res.status}.`,
          details: { httpStatus: res.status, body, anomaly },
        };
      }
    } catch (err) {
      return {
        scenario: `invalid-payload-${anomaly.toLowerCase()}`,
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate invalid payload: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates Out-of-Order message transmission (sequence N+10 first, then sequence N-5).
   */
  public async runOutOfOrderScenario(
    type: 'soil' | 'water' | 'reservoir'
  ): Promise<ScenarioResult> {
    try {
      const now = Date.now();
      const futureTime = new Date(now + 10000).toISOString();
      const pastTime = new Date(now - 10000).toISOString();

      if (type === 'soil') {
        await this.sendSoilTelemetry({}, { sequence: 100, recordedAt: futureTime });
        await this.sendSoilTelemetry({}, { sequence: 50, recordedAt: pastTime });
      } else if (type === 'water') {
        await this.sendWaterTelemetry({}, { sequence: 100, recordedAt: futureTime });
        await this.sendWaterTelemetry({}, { sequence: 50, recordedAt: pastTime });
      } else {
        await this.publishReservoirTelemetry({}, { sequence: 100, recordedAt: futureTime });
        await this.publishReservoirTelemetry({}, { sequence: 50, recordedAt: pastTime });
      }

      return {
        scenario: 'out-of-order',
        simulated: true,
        status: 'SUCCESS',
        message: `Successfully simulated out-of-order payloads for channel '${type}'.`,
      };
    } catch (err) {
      return {
        scenario: 'out-of-order',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate out-of-order payload: ${String(err)}`,
      };
    }
  }

  /**
   * Simulates MQTT Disconnect and Reconnect cycle.
   */
  public async runDisconnectReconnectScenario(): Promise<ScenarioResult> {
    try {
      await this.connectMqtt();
      if (this.client) {
        await new Promise<void>((resolve) => {
          this.client?.end(true, () => resolve());
        });
      }
      this.client = null;
      await this.connectMqtt();

      return {
        scenario: 'disconnect-reconnect',
        simulated: true,
        status: 'SUCCESS',
        message: `Successfully simulated disconnect and reconnect cycle for MQTT client on device '${this.getTankDeviceId()}'.`,
      };
    } catch (err) {
      return {
        scenario: 'disconnect-reconnect',
        simulated: false,
        status: 'FAILED',
        message: `Failed to simulate disconnect/reconnect: ${String(err)}`,
      };
    }
  }

  /**
   * Handles Heartbeat Simulation request.
   * NOTE: TASK-0407 is BLOCKED by DECISIONS.md §3 (TBD offline and stale threshold values).
   */
  public runHeartbeatScenario(): ScenarioResult {
    return {
      scenario: 'heartbeat',
      simulated: false,
      status: 'BLOCKED',
      message:
        'Heartbeat intervals and online/offline/stale threshold values from TASK-0407 remain TBD (BLOCKED by docs/DECISIONS.md §3). Heartbeat simulation skipped.',
    };
  }

  /**
   * Handles Timeout Simulation request.
   * NOTE: TASK-0809 is BLOCKED by DECISIONS.md §3 (TBD command ACK & completion timeout durations).
   */
  public runTimeoutScenario(): ScenarioResult {
    return {
      scenario: 'timeout',
      simulated: false,
      status: 'BLOCKED',
      message:
        'Command ACK and completion timeout durations from TASK-0809 remain TBD (BLOCKED by docs/DECISIONS.md §3). Timeout simulation skipped.',
    };
  }

  /**
   * Disconnects MQTT client gracefully.
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client?.end(false, () => resolve());
      });
      this.client = null;
    }
  }
}

// -----------------------------------------------------------------------------
// CLI Runner Entrypoint
// -----------------------------------------------------------------------------

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const arg = args.find((a) => a.startsWith(prefix));
    if (arg) return arg.slice(prefix.length);
    const flagIndex = args.indexOf(`--${name}`);
    if (flagIndex !== -1 && args[flagIndex + 1] && !args[flagIndex + 1].startsWith('--')) {
      return args[flagIndex + 1];
    }
    return undefined;
  };

  const scenario = getArg('scenario') || 'soil-telemetry';
  const explicitDeviceId = getArg('device-id');
  const soilDeviceId =
    getArg('soil-device-id') || (scenario === 'soil-telemetry' ? explicitDeviceId : undefined);
  const waterDeviceId =
    getArg('water-device-id') || (scenario === 'water-telemetry' ? explicitDeviceId : undefined);
  const tankDeviceId =
    getArg('tank-device-id') ||
    (scenario !== 'soil-telemetry' && scenario !== 'water-telemetry'
      ? explicitDeviceId
      : undefined);
  const siteId = getArg('site-id');
  const env = getArg('env') as 'development' | 'staging' | 'production' | undefined;
  const apiUrl = getArg('api-url');
  const brokerUrl = getArg('broker-url');

  const simulator = new DeviceSimulator({
    deviceId: explicitDeviceId,
    soilDeviceId,
    waterDeviceId,
    tankDeviceId,
    siteId,
    environment: env,
    apiBaseUrl: apiUrl,
    brokerUrl,
  });

  console.log(
    `[DeviceSimulator CLI] Environment: '${simulator.config.environment}', Site: '${simulator.config.siteId}'`
  );
  console.log(`[DeviceSimulator CLI] Scenario: '${scenario}'`);

  try {
    const currentTargetId =
      scenario === 'soil-telemetry'
        ? simulator.getSoilDeviceId()
        : scenario === 'water-telemetry'
          ? simulator.getWaterDeviceId()
          : simulator.getTankDeviceId();

    console.log(`[DeviceSimulator CLI] Initialized for Target Device ID: '${currentTargetId}'`);

    let result: ScenarioResult;

    switch (scenario) {
      case 'soil-telemetry':
        const soilRes = await simulator.sendSoilTelemetry();
        result = {
          scenario,
          simulated: true,
          status: soilRes.ok ? 'SUCCESS' : 'FAILED',
          message: `Sent soil telemetry REST payload. Response status: ${soilRes.status}`,
          details: {
            deviceId: simulator.getSoilDeviceId(),
            status: soilRes.status,
            body: soilRes.body,
          },
        };
        break;
      case 'water-telemetry':
        const waterRes = await simulator.sendWaterTelemetry();
        result = {
          scenario,
          simulated: true,
          status: waterRes.ok ? 'SUCCESS' : 'FAILED',
          message: `Sent water telemetry REST payload. Response status: ${waterRes.status}`,
          details: {
            deviceId: simulator.getWaterDeviceId(),
            status: waterRes.status,
            body: waterRes.body,
          },
        };
        break;
      case 'reservoir-telemetry':
        const resObj = await simulator.publishReservoirTelemetry();
        result = {
          scenario,
          simulated: true,
          status: 'SUCCESS',
          message: `Published reservoir telemetry payload to topic '${resObj.topic}'.`,
          details: {
            deviceId: simulator.getTankDeviceId(),
            topic: resObj.topic,
            payload: resObj.payload,
          },
        };
        break;
      case 'faucet-dispense':
        const cmdId = getArg('command-id') || `cmd-cli-${Date.now()}`;
        const phase = Number(getArg('phase') || '2');
        const targetVol = FAUCET_PRESET_VOLUMES[phase] || 1000;
        result = await simulator.runFaucetDispenseLifecycleScenario(cmdId, targetVol);
        break;
      case 'faucet-reject':
        const rejCmdId = getArg('command-id') || `cmd-cli-${Date.now()}`;
        const reason = (getArg('reason') || 'DEVICE_BUSY') as FaucetAckReasonCode;
        result = await simulator.runFaucetRejectionScenario(rejCmdId, reason);
        break;
      case 'faucet-fail':
        const failCmdId = getArg('command-id') || `cmd-cli-${Date.now()}`;
        const failReason = getArg('reason') || 'FLOW_NOT_DETECTED';
        result = await simulator.runFaucetFailureScenario(failCmdId, failReason);
        break;
      case 'faucet-listener':
        console.log(
          `[DeviceSimulator CLI] Listening for faucet commands on topic 'agriculture/${simulator.config.environment}/${simulator.config.siteId}/${simulator.getTankDeviceId()}/command/faucet'...`
        );
        await simulator.listenFaucetCommands(async (cmd) => {
          console.log(`[DeviceSimulator CLI] Received Faucet Command:`, cmd);
          console.log(
            `[DeviceSimulator CLI] Automatically executing dispense lifecycle for command '${cmd.commandId}'...`
          );
          await simulator.runFaucetDispenseLifecycleScenario(cmd.commandId, cmd.targetVolumeMl);
        });
        // Keep listener open
        return;
      case 'duplicate':
        result = await simulator.runDuplicatePayloadScenario('reservoir');
        break;
      case 'invalid-json':
        result = await simulator.runInvalidPayloadScenario('reservoir', 'INVALID_JSON');
        break;
      case 'missing-field':
        result = await simulator.runInvalidPayloadScenario('reservoir', 'MISSING_FIELD');
        break;
      case 'non-finite':
        result = await simulator.runInvalidPayloadScenario('reservoir', 'NON_FINITE_NUMBER');
        break;
      case 'device-mismatch':
        result = await simulator.runInvalidPayloadScenario('reservoir', 'TOPIC_DEVICE_MISMATCH');
        break;
      case 'out-of-order':
        result = await simulator.runOutOfOrderScenario('reservoir');
        break;
      case 'disconnect-reconnect':
        result = await simulator.runDisconnectReconnectScenario();
        break;
      case 'heartbeat':
        result = simulator.runHeartbeatScenario();
        break;
      case 'timeout':
        result = simulator.runTimeoutScenario();
        break;
      default:
        result = {
          scenario,
          simulated: false,
          status: 'FAILED',
          message: `Unknown scenario '${scenario}'. Allowed scenarios: soil-telemetry, water-telemetry, reservoir-telemetry, faucet-dispense, faucet-reject, faucet-fail, faucet-listener, duplicate, invalid-json, missing-field, non-finite, device-mismatch, out-of-order, disconnect-reconnect, heartbeat, timeout.`,
        };
        break;
    }

    console.log(`\n[DeviceSimulator CLI] Scenario Result:`, result);
    await simulator.disconnect();
  } catch (err) {
    console.error(`[DeviceSimulator CLI] Execution Error:`, err);
    await simulator.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}
