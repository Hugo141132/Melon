import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import fs from 'fs';
import { GatewayEnv, redactString } from '../config/env';
import { logger } from '../observability/logger';

export type MqttConnectionStatus =
  'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export type MessageHandler = (topic: string, payload: Buffer) => void;

export class GatewayMqttClient {
  private client: MqttClient | null = null;
  private status: MqttConnectionStatus = 'DISCONNECTED';
  private lastError: string | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private env: GatewayEnv;
  private customClientFactory?: (options: IClientOptions) => MqttClient;

  constructor(env: GatewayEnv, customClientFactory?: (options: IClientOptions) => MqttClient) {
    this.env = env;
    this.customClientFactory = customClientFactory;
  }

  public getStatus(): MqttConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'CONNECTED' && (this.client?.connected ?? false);
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public async connect(): Promise<void> {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
      return;
    }

    this.status = 'CONNECTING';
    const brokerUrl = this.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

    const options: IClientOptions = {
      clientId: this.env.MQTT_GATEWAY_CLIENT_ID || `gateway-${Date.now()}`,
      username: this.env.MQTT_GATEWAY_USERNAME,
      password: this.env.MQTT_GATEWAY_PASSWORD,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      rejectUnauthorized: true,
    };

    // Mutually-authenticated or Server-authenticated TLS certificate paths if configured
    if (this.env.MQTT_CA_CERT_PATH && fs.existsSync(this.env.MQTT_CA_CERT_PATH)) {
      options.ca = fs.readFileSync(this.env.MQTT_CA_CERT_PATH);
    }
    if (this.env.MQTT_CLIENT_CERT_PATH && fs.existsSync(this.env.MQTT_CLIENT_CERT_PATH)) {
      options.cert = fs.readFileSync(this.env.MQTT_CLIENT_CERT_PATH);
    }
    if (this.env.MQTT_CLIENT_KEY_PATH && fs.existsSync(this.env.MQTT_CLIENT_KEY_PATH)) {
      options.key = fs.readFileSync(this.env.MQTT_CLIENT_KEY_PATH);
    }

    logger.info('Connecting to MQTT broker...', {
      brokerUrl,
      clientId: options.clientId,
      username: options.username,
    });

    try {
      if (this.customClientFactory) {
        this.client = this.customClientFactory(options);
      } else {
        this.client = mqtt.connect(brokerUrl, options);
      }

      this.setupEventListeners();
    } catch (err: any) {
      this.status = 'ERROR';
      this.lastError = err?.message || 'Failed to initialize MQTT connection';
      logger.error('MQTT connection initialization failed', err);
      throw err;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.status = 'CONNECTED';
      this.lastError = null;
      logger.info('MQTT client successfully connected to broker');
    });

    this.client.on('reconnect', () => {
      this.status = 'RECONNECTING';
      logger.warn('MQTT client reconnecting to broker...');
    });

    this.client.on('close', () => {
      if (this.status !== 'DISCONNECTED') {
        this.status = 'DISCONNECTED';
        logger.warn('MQTT client connection closed');
      }
    });

    this.client.on('offline', () => {
      this.status = 'DISCONNECTED';
      logger.warn('MQTT client went offline');
    });

    this.client.on('error', (err: Error) => {
      this.status = 'ERROR';
      const sanitizedMsg = redactString(err.message);
      this.lastError = sanitizedMsg;
      logger.error('MQTT client error occurred', new Error(sanitizedMsg));
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      for (const handler of this.messageHandlers) {
        try {
          handler(topic, payload);
        } catch (handlerErr) {
          logger.error('Error executing message handler', handlerErr, { topic });
        }
      }
    });
  }

  public async subscribe(topic: string | string[]): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot subscribe: MQTT client is not initialized');
    }

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topic, (err) => {
        const topicMeta = Array.isArray(topic) ? topic.join(',') : topic;
        if (err) {
          logger.error('Failed to subscribe to topic', err, { topic: topicMeta });
          reject(err);
        } else {
          logger.info('Subscribed to MQTT topic', { topic: topicMeta });
          resolve();
        }
      });
    });
  }

  public async publish(
    topic: string,
    message: string | Buffer,
    qos: 0 | 1 | 2 = 1,
    retain: boolean = false
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot publish: MQTT client is not initialized');
    }

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, message, { qos, retain }, (err) => {
        if (err) {
          logger.error('Failed to publish MQTT message', err, { topic });
          reject(err);
        } else {
          logger.debug('MQTT message published successfully', { topic });
          resolve();
        }
      });
    });
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      this.status = 'DISCONNECTED';
      return;
    }

    this.status = 'DISCONNECTED';
    return new Promise((resolve) => {
      this.client!.end(false, {}, () => {
        logger.info('MQTT client disconnected gracefully');
        this.client = null;
        resolve();
      });
    });
  }
}
