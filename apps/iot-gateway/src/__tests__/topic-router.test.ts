import { describe, it, expect } from 'vitest';
import { mqttTopicRouter, AllowedEnvironment, TopicCategory } from '../mqtt/router';

describe('MqttTopicRouter Unit Tests', () => {
  const router = mqttTopicRouter;

  describe('Valid Topic Parsing & Validation', () => {
    const validSubtopics: Array<{
      topic: string;
      expected: {
        environment: AllowedEnvironment;
        siteId: string;
        deviceId: string;
        category: TopicCategory;
        subtype?: string;
      };
    }> = [
      {
        topic: 'agriculture/development/site-01/esp32-001/telemetry/soil',
        expected: {
          environment: 'development',
          siteId: 'site-01',
          deviceId: 'esp32-001',
          category: 'telemetry',
          subtype: 'soil',
        },
      },
      {
        topic: 'agriculture/staging/site-02/water-node-01/telemetry/water',
        expected: {
          environment: 'staging',
          siteId: 'site-02',
          deviceId: 'water-node-01',
          category: 'telemetry',
          subtype: 'water',
        },
      },
      {
        topic: 'agriculture/production/site-03/tank-01/status',
        expected: {
          environment: 'production',
          siteId: 'site-03',
          deviceId: 'tank-01',
          category: 'status',
          subtype: undefined,
        },
      },
      {
        topic: 'agriculture/development/site-01/esp32-001/heartbeat',
        expected: {
          environment: 'development',
          siteId: 'site-01',
          deviceId: 'esp32-001',
          category: 'heartbeat',
          subtype: undefined,
        },
      },
      {
        topic: 'agriculture/production/site-01/valve-01/command/faucet',
        expected: {
          environment: 'production',
          siteId: 'site-01',
          deviceId: 'valve-01',
          category: 'command',
          subtype: 'faucet',
        },
      },
      {
        topic: 'agriculture/staging/site-01/valve-01/ack/faucet',
        expected: {
          environment: 'staging',
          siteId: 'site-01',
          deviceId: 'valve-01',
          category: 'ack',
          subtype: 'faucet',
        },
      },
      {
        topic: 'agriculture/production/site-01/valve-01/event/faucet',
        expected: {
          environment: 'production',
          siteId: 'site-01',
          deviceId: 'valve-01',
          category: 'event',
          subtype: 'faucet',
        },
      },
      {
        topic: 'agriculture/development/site-01/esp32-001/config',
        expected: {
          environment: 'development',
          siteId: 'site-01',
          deviceId: 'esp32-001',
          category: 'config',
          subtype: undefined,
        },
      },
      {
        topic: 'agriculture/production/site-01/esp32-001/ack/config',
        expected: {
          environment: 'production',
          siteId: 'site-01',
          deviceId: 'esp32-001',
          category: 'ack',
          subtype: 'config',
        },
      },
    ];

    validSubtopics.forEach(({ topic, expected }) => {
      it(`correctly parses valid topic: ${topic}`, () => {
        const parsed = router.parseTopic(topic);
        expect(parsed).not.toBeNull();
        expect(parsed).toEqual(expected);

        const validation = router.validateTopic(topic);
        expect(validation.valid).toBe(true);
        expect(validation.error).toBeUndefined();
        expect(validation.parsed).toEqual(expected);
      });
    });
  });

  describe('Invalid Topic Rejections', () => {
    it('rejects non-string or empty topics', () => {
      expect(router.parseTopic('')).toBeNull();
      expect(router.validateTopic('').valid).toBe(false);
      expect(router.validateTopic(null as any).valid).toBe(false);
    });

    it('rejects invalid root prefix', () => {
      const topic = 'other/development/site-01/dev-01/status';
      expect(router.parseTopic(topic)).toBeNull();
      expect(router.validateTopic(topic).error).toContain(
        'Root topic segment must be "agriculture"'
      );
    });

    it('rejects invalid environment values', () => {
      const topic1 = 'agriculture/dev/site-01/dev-01/status';
      const topic2 = 'agriculture/prod/site-01/dev-01/status';
      const topic3 = 'agriculture/local/site-01/dev-01/status';

      expect(router.parseTopic(topic1)).toBeNull();
      expect(router.parseTopic(topic2)).toBeNull();
      expect(router.parseTopic(topic3)).toBeNull();
      expect(router.validateTopic(topic1).error).toContain('Invalid environment "dev"');
    });

    it('rejects invalid category names', () => {
      const topic = 'agriculture/development/site-01/dev-01/sensor_data';
      expect(router.parseTopic(topic)).toBeNull();
      expect(router.validateTopic(topic).error).toContain('Invalid topic category "sensor_data"');
    });

    it('rejects invalid subtype for category requiring subtype', () => {
      expect(router.parseTopic('agriculture/development/site-01/dev-01/telemetry/air')).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01/dev-01/command/pump')).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01/dev-01/ack/pump')).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01/dev-01/event/soil')).toBeNull();
    });

    it('rejects missing subtype for category requiring subtype', () => {
      const topic = 'agriculture/development/site-01/dev-01/telemetry';
      expect(router.parseTopic(topic)).toBeNull();
      expect(router.validateTopic(topic).error).toContain('requires a valid sub-type');
    });

    it('rejects extra subtype for category accepting no subtype', () => {
      expect(router.parseTopic('agriculture/development/site-01/dev-01/status/soil')).toBeNull();
      expect(
        router.parseTopic('agriculture/development/site-01/dev-01/heartbeat/water')
      ).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01/dev-01/config/faucet')).toBeNull();
    });

    it('rejects malformed segment counts', () => {
      expect(router.parseTopic('agriculture/development/site-01/dev-01')).toBeNull();
      expect(
        router.parseTopic('agriculture/development/site-01/dev-01/telemetry/soil/extra')
      ).toBeNull();
    });

    it('rejects malformed siteId or deviceId slugs', () => {
      expect(router.parseTopic('agriculture/development//dev-01/status')).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01//status')).toBeNull();
      expect(router.parseTopic('agriculture/development/site 01/dev-01/status')).toBeNull();
      expect(router.parseTopic('agriculture/development/site-01/dev@01/status')).toBeNull();
    });
  });

  describe('Wildcard Rejections in Published Topics', () => {
    it('rejects topics containing + wildcard', () => {
      const topic = 'agriculture/development/+/esp32-001/status';
      expect(router.parseTopic(topic)).toBeNull();
      expect(router.validateTopic(topic).error).toContain('Wildcards (+ or #) are not allowed');
    });

    it('rejects topics containing # wildcard', () => {
      const topic = 'agriculture/development/site-01/#';
      expect(router.parseTopic(topic)).toBeNull();
      expect(router.validateTopic(topic).error).toContain('Wildcards (+ or #) are not allowed');
    });
  });

  describe('Environment Isolation Enforcement', () => {
    const devTopic = 'agriculture/development/site-01/dev-01/status';
    const prodTopic = 'agriculture/production/site-01/dev-01/status';

    it('validates matching environment', () => {
      expect(router.parseTopic(devTopic, 'development')).not.toBeNull();
      expect(router.parseTopic(prodTopic, 'production')).not.toBeNull();
      expect(router.matchesEnvironment(devTopic, 'development')).toBe(true);
      expect(router.matchesEnvironment(devTopic, 'production')).toBe(false);
    });

    it('rejects mismatched environment', () => {
      expect(router.parseTopic(devTopic, 'production')).toBeNull();
      expect(router.parseTopic(prodTopic, 'development')).toBeNull();

      const validation = router.validateTopic(devTopic, 'production');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Environment mismatch');
    });
  });

  describe('Topic vs Payload Device ID Mismatch Validation', () => {
    const topic = 'agriculture/development/site-01/esp32-001/telemetry/soil';

    it('returns true when topic deviceId matches payload deviceId', () => {
      expect(router.isTopicPayloadMatch(topic, 'esp32-001')).toBe(true);
      expect(router.isTopicPayloadMatch(topic, 'esp32-001 ', 'development')).toBe(true);
    });

    it('returns false when topic deviceId differs from payload deviceId', () => {
      expect(router.isTopicPayloadMatch(topic, 'esp32-999')).toBe(false);
      expect(router.isTopicPayloadMatch(topic, 'different-device')).toBe(false);
    });

    it('returns false when payload deviceId is empty or invalid', () => {
      expect(router.isTopicPayloadMatch(topic, '')).toBe(false);
      expect(router.isTopicPayloadMatch(topic, null as any)).toBe(false);
    });

    it('returns false when environment isolation fails', () => {
      expect(router.isTopicPayloadMatch(topic, 'esp32-001', 'production')).toBe(false);
    });

    it('matches device correctly with matchesDevice helper', () => {
      expect(router.matchesDevice(topic, 'esp32-001')).toBe(true);
      expect(router.matchesDevice(topic, 'esp32-001', 'development')).toBe(true);
      expect(router.matchesDevice(topic, 'esp32-001', 'production')).toBe(false);
      expect(router.matchesDevice(topic, 'other-device')).toBe(false);
    });
  });

  describe('Subscription Pattern & Helper Functions', () => {
    it('generates wildcard subscription pattern without site or device', () => {
      expect(router.getSubscriptionPattern('development')).toBe('agriculture/development/+/+/#');
      expect(router.getSubscriptionPattern('production')).toBe('agriculture/production/+/+/#');
    });

    it('generates specific subscription pattern with site and device', () => {
      expect(router.getSubscriptionPattern('development', 'site-01')).toBe(
        'agriculture/development/site-01/+/#'
      );
      expect(router.getSubscriptionPattern('production', 'site-01', 'esp32-001')).toBe(
        'agriculture/production/site-01/esp32-001/#'
      );
    });

    it('generates category subscription pattern', () => {
      expect(router.getCategorySubscriptionPattern('development', 'telemetry', 'soil')).toBe(
        'agriculture/development/+/+/telemetry/soil'
      );
      expect(router.getCategorySubscriptionPattern('production', 'status')).toBe(
        'agriculture/production/+/+/status'
      );
    });

    it('builds canonical valid topics using buildTopic helper', () => {
      const topic1 = router.buildTopic('development', 'site-01', 'dev-01', 'telemetry', 'soil');
      expect(topic1).toBe('agriculture/development/site-01/dev-01/telemetry/soil');

      const topic2 = router.buildTopic('production', 'site-02', 'dev-02', 'status');
      expect(topic2).toBe('agriculture/production/site-02/dev-02/status');
    });

    it('throws error when buildTopic is called with invalid parameters', () => {
      expect(() =>
        router.buildTopic('development', 'site 01', 'dev-01', 'telemetry', 'soil')
      ).toThrow('Failed to build valid topic');
    });
  });
});
