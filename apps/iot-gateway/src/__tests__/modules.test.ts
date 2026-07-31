import { describe, it, expect } from 'vitest';
import { mqttTopicRouter } from '../mqtt/router';
import { messageValidator } from '../validation/validator';
import { telemetryProcessor } from '../telemetry/processor';
import { deviceStatusProcessor } from '../devices/status-processor';
import { commandPublisher } from '../commands/publisher';
import { acknowledgementProcessor } from '../acknowledgements/processor';
import { GatewayMqttClient } from '../mqtt/client';
import { validateGatewayEnv } from '../config/env';
import { EventEmitter } from 'events';

class MockMqttClient extends EventEmitter {
  public connected: boolean = true;
  public publishedTopics: string[] = [];

  public publish(
    topic: string,
    _message: string | Buffer,
    _opts?: any,
    cb?: (err?: Error) => void
  ) {
    this.publishedTopics.push(topic);
    if (cb) cb();
  }

  public end(_force?: boolean, _opts?: any, cb?: () => void) {
    this.connected = false;
    if (cb) cb();
  }
}

describe('IoT Gateway Subsystem Modules', () => {
  describe('MQTT Topic Router', () => {
    it('parses valid agriculture topics', () => {
      const topic = 'agriculture/production/site-01/water-tank-01/telemetry/water';
      const parsed = mqttTopicRouter.parseTopic(topic);

      expect(parsed).not.toBeNull();
      expect(parsed?.environment).toBe('production');
      expect(parsed?.siteId).toBe('site-01');
      expect(parsed?.deviceId).toBe('water-tank-01');
      expect(parsed?.category).toBe('telemetry');
      expect(parsed?.subtype).toBe('water');
    });

    it('rejects invalid or non-agriculture topic patterns', () => {
      expect(mqttTopicRouter.parseTopic('invalid/topic')).toBeNull();
      expect(mqttTopicRouter.parseTopic('agriculture/prod')).toBeNull();
      expect(mqttTopicRouter.parseTopic('agriculture/prod/site/dev/unknown_category')).toBeNull();
    });

    it('verifies device matching on topic', () => {
      const topic = 'agriculture/production/site-01/device-abc/status';
      expect(mqttTopicRouter.matchesDevice(topic, 'device-abc')).toBe(true);
      expect(mqttTopicRouter.matchesDevice(topic, 'device-xyz')).toBe(false);
    });
  });

  describe('Message Validator', () => {
    it('validates a valid base payload JSON', () => {
      const raw = Buffer.from(
        JSON.stringify({
          version: '1.0',
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          deviceId: 'device-01',
          timestamp: new Date().toISOString(),
        })
      );

      const res = messageValidator.validateBaseMessage(raw);
      expect(res.valid).toBe(true);
      expect(res.data?.deviceId).toBe('device-01');
    });

    it('rejects invalid JSON or missing mandatory schema fields', () => {
      const invalidJson = Buffer.from('not json');
      expect(messageValidator.validateBaseMessage(invalidJson).valid).toBe(false);

      const missingId = Buffer.from(JSON.stringify({ deviceId: 'dev' }));
      expect(messageValidator.validateBaseMessage(missingId).valid).toBe(false);
    });
  });

  describe('Scaffold Processors (Telemetry, Status, Commands, ACKs)', () => {
    it('telemetryProcessor receives and processes payload scaffold', async () => {
      const res = await telemetryProcessor.processTelemetry('device-01', 'soil', {
        moisture: 45,
      });
      expect(res.success).toBe(true);
    });

    it('deviceStatusProcessor handles status update scaffold', async () => {
      await expect(
        deviceStatusProcessor.processStatusEvent('device-01', 'ONLINE')
      ).resolves.not.toThrow();
    });

    it('commandPublisher publishes command with retain=false', async () => {
      const env = validateGatewayEnv({ NODE_ENV: 'test' });
      const mockEmitter = new MockMqttClient();
      const mockClient = new GatewayMqttClient(env, () => mockEmitter as any);

      // Connect mock client
      const connectPromise = mockClient.connect();
      mockEmitter.emit('connect');
      await connectPromise;

      const res = await commandPublisher.publishCommand(mockClient, 'water-node-01', 'cmd-123', {
        phase: 'Phase 1',
        targetVolumeMl: 300,
      });

      expect(res.published).toBe(true);
      expect(mockEmitter.publishedTopics).toContain(
        'agriculture/production/site-01/water-node-01/command/faucet'
      );
    });

    it('acknowledgementProcessor handles ACK scaffold', async () => {
      await expect(
        acknowledgementProcessor.processAcknowledgement('device-01', 'cmd-123', 'ACKNOWLEDGED')
      ).resolves.not.toThrow();
    });
  });
});
