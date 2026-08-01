import { describe, it, expect, beforeEach } from 'vitest';
import {
  GatewayMetricsCollector,
  generateCorrelationId,
  createCorrelationMeta,
} from '../observability/metrics';
import { validateGatewayEnv } from '../config/env';
import { buildApp } from '../app';

describe('TASK-0409 — Gateway Observability', () => {
  let collector: GatewayMetricsCollector;

  beforeEach(() => {
    collector = new GatewayMetricsCollector();
  });

  describe('Broker-Agnostic Metrics Collector', () => {
    it('initializes with default metrics snapshot', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot.broker.state).toBe('DISCONNECTED');
      expect(snapshot.broker.connectsTotal).toBe(0);
      expect(snapshot.broker.reconnectsTotal).toBe(0);
      expect(snapshot.broker.errorsTotal).toBe(0);

      expect(snapshot.messages.receivedTotal).toBe(0);
      expect(snapshot.messages.validTotal).toBe(0);
      expect(snapshot.messages.invalidTotal).toBe(0);
      expect(snapshot.messages.duplicateTotal).toBe(0);
      expect(snapshot.messages.unknownDeviceAttemptsTotal).toBe(0);

      expect(snapshot.latency.count).toBe(0);
      expect(snapshot.latency.avgMs).toBe(0);

      expect(snapshot.devices.connectedCount).toBe(0);
      expect(snapshot.devices.disconnectedCount).toBe(0);
      expect(snapshot.devices.activeDeviceIds).toEqual([]);

      expect(snapshot.commands.publishedTotal).toBe(0);
      expect(snapshot.commands.acknowledgementsTotal).toBe(0);
      expect(snapshot.commands.failuresTotal).toBe(0);
      expect(snapshot.commands.timeoutsTotal).toBe(0);

      expect(typeof snapshot.uptimeSeconds).toBe('number');
      expect(snapshot.timestamp).toBeDefined();
    });

    it('tracks broker connection lifecycle state and counters', () => {
      collector.recordBrokerState('CONNECTING');
      expect(collector.getSnapshot().broker.state).toBe('CONNECTING');

      collector.incrementConnects();
      expect(collector.getSnapshot().broker.state).toBe('CONNECTED');
      expect(collector.getSnapshot().broker.connectsTotal).toBe(1);

      collector.incrementReconnects();
      expect(collector.getSnapshot().broker.state).toBe('RECONNECTING');
      expect(collector.getSnapshot().broker.reconnectsTotal).toBe(1);

      collector.incrementErrors();
      expect(collector.getSnapshot().broker.state).toBe('ERROR');
      expect(collector.getSnapshot().broker.errorsTotal).toBe(1);
    });

    it('tracks message result metrics', () => {
      collector.incrementMessagesReceived();
      collector.incrementMessagesValid();
      collector.incrementMessagesInvalid();
      collector.incrementMessagesDuplicate();
      collector.incrementUnknownDeviceAttempts();

      const snapshot = collector.getSnapshot();
      expect(snapshot.messages.receivedTotal).toBe(1);
      expect(snapshot.messages.validTotal).toBe(1);
      expect(snapshot.messages.invalidTotal).toBe(1);
      expect(snapshot.messages.duplicateTotal).toBe(1);
      expect(snapshot.messages.unknownDeviceAttemptsTotal).toBe(1);
    });

    it('records ingestion latency statistics accurately', () => {
      collector.recordIngestionLatency(10.5);
      collector.recordIngestionLatency(20.0);
      collector.recordIngestionLatency(5.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.latency.count).toBe(3);
      expect(snapshot.latency.totalMs).toBe(36.0);
      expect(snapshot.latency.minMs).toBe(5.5);
      expect(snapshot.latency.maxMs).toBe(20.0);
      expect(snapshot.latency.avgMs).toBe(12.0);
      expect(snapshot.latency.lastMs).toBe(5.5);
    });

    it('tracks connected and disconnected device counts', () => {
      collector.recordDeviceConnected('device-01');
      collector.recordDeviceConnected('device-02');
      expect(collector.getSnapshot().devices.connectedCount).toBe(2);
      expect(collector.getSnapshot().devices.activeDeviceIds).toContain('device-01');
      expect(collector.getSnapshot().devices.activeDeviceIds).toContain('device-02');

      collector.recordDeviceDisconnected('device-01');
      expect(collector.getSnapshot().devices.connectedCount).toBe(1);
      expect(collector.getSnapshot().devices.disconnectedCount).toBe(1);
      expect(collector.getSnapshot().devices.activeDeviceIds).toEqual(['device-02']);
    });

    it('tracks command status counters', () => {
      collector.incrementCommandsPublished();
      collector.incrementAcknowledgements();
      collector.incrementCommandFailures();
      collector.incrementCommandTimeouts();

      const snapshot = collector.getSnapshot();
      expect(snapshot.commands.publishedTotal).toBe(1);
      expect(snapshot.commands.acknowledgementsTotal).toBe(1);
      expect(snapshot.commands.failuresTotal).toBe(1);
      expect(snapshot.commands.timeoutsTotal).toBe(1);
    });

    it('resets all collected metrics on reset()', () => {
      collector.incrementConnects();
      collector.incrementMessagesReceived();
      collector.recordIngestionLatency(15);
      collector.recordDeviceConnected('device-01');

      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.broker.state).toBe('DISCONNECTED');
      expect(snapshot.broker.connectsTotal).toBe(0);
      expect(snapshot.messages.receivedTotal).toBe(0);
      expect(snapshot.latency.count).toBe(0);
      expect(snapshot.devices.connectedCount).toBe(0);
    });
  });

  describe('Correlation Identifiers & Secret Redaction', () => {
    it('generates unique correlation IDs with optional prefix', () => {
      const id1 = generateCorrelationId('test');
      const id2 = generateCorrelationId('test');
      expect(id1).toMatch(/^test-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('creates correlation metadata while redacting sensitive secrets', () => {
      const rawMeta = {
        deviceId: 'device-123',
        messageId: 'msg-456',
        MQTT_GATEWAY_PASSWORD: 'secretpassword123',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      };

      const meta = createCorrelationMeta(rawMeta);

      expect(meta.correlationId).toBeDefined();
      expect(meta.deviceId).toBe('device-123');
      expect(meta.messageId).toBe('msg-456');
      expect(meta.MQTT_GATEWAY_PASSWORD).toBe('[REDACTED]');
      expect(meta.DATABASE_URL).toBe('postgresql://user:***@localhost:5432/db');
    });
  });

  describe('Preservation of Existing /health and /ready Contracts', () => {
    let env: ReturnType<typeof validateGatewayEnv>;

    beforeEach(() => {
      env = validateGatewayEnv({
        NODE_ENV: 'test',
        PORT: '3001',
      });
    });

    it('GET /health returns pass status and uptime without secrets', async () => {
      const { app } = buildApp({ env });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.status).toBe('pass');
      expect(payload.service).toBe('iot-gateway');
      expect(typeof payload.uptime).toBe('number');
      expect(payload.timestamp).toBeDefined();
      expect(JSON.stringify(payload)).not.toContain('password');
      expect(JSON.stringify(payload)).not.toContain('secret');
    });

    it('GET /ready returns DEGRADED 503 when DB is connected but MQTT is disconnected', async () => {
      const { app } = buildApp({
        env,
        dbChecker: async () => true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const payload = response.json();
      expect(payload.status).toBe('DEGRADED');
      expect(payload.service).toBe('iot-gateway');
      expect(payload.database.status).toBe('CONNECTED');
      expect(payload.mqtt.status).toBe('DISCONNECTED');
    });
  });
});
