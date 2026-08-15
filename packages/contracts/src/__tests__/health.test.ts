import { describe, it, expect } from 'vitest';
import {
  LivenessResponseSchema,
  ReadinessStatusSchema,
  DependencyStatusSchema,
  GatewayReadinessResponseSchema,
  WebReadinessResponseSchema,
} from '../health';

describe('Health Contracts', () => {
  describe('LivenessResponseSchema', () => {
    it('validates canonical liveness payload', () => {
      const valid = { status: 'ok' };
      const parsed = LivenessResponseSchema.parse(valid);
      expect(parsed.status).toBe('ok');
    });

    it('rejects invalid liveness status', () => {
      expect(() => LivenessResponseSchema.parse({ status: 'pass' })).toThrow();
      expect(() => LivenessResponseSchema.parse({ status: 'ready' })).toThrow();
      expect(() => LivenessResponseSchema.parse({})).toThrow();
    });
  });

  describe('ReadinessStatusSchema & DependencyStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(ReadinessStatusSchema.parse('ready')).toBe('ready');
      expect(ReadinessStatusSchema.parse('degraded')).toBe('degraded');
      expect(ReadinessStatusSchema.parse('down')).toBe('down');

      expect(DependencyStatusSchema.parse('up')).toBe('up');
      expect(DependencyStatusSchema.parse('down')).toBe('down');
    });

    it('rejects invalid statuses', () => {
      expect(() => ReadinessStatusSchema.parse('pass')).toThrow();
      expect(() => ReadinessStatusSchema.parse('UNKNOWN')).toThrow();
      expect(() => DependencyStatusSchema.parse('ok')).toThrow();
    });
  });

  describe('GatewayReadinessResponseSchema', () => {
    it('validates canonical gateway ready payload', () => {
      const payload = {
        status: 'ready',
        dependencies: {
          database: 'up',
          broker: 'up',
        },
      };
      const parsed = GatewayReadinessResponseSchema.parse(payload);
      expect(parsed.status).toBe('ready');
      expect(parsed.dependencies.database).toBe('up');
      expect(parsed.dependencies.broker).toBe('up');
    });

    it('validates gateway degraded/down payload', () => {
      const payload = {
        status: 'degraded',
        dependencies: {
          database: 'up',
          broker: 'down',
        },
      };
      const parsed = GatewayReadinessResponseSchema.parse(payload);
      expect(parsed.status).toBe('degraded');
      expect(parsed.dependencies.broker).toBe('down');
    });

    it('rejects payload missing dependencies', () => {
      expect(() =>
        GatewayReadinessResponseSchema.parse({
          status: 'ready',
          dependencies: { database: 'up' },
        })
      ).toThrow();
    });
  });

  describe('WebReadinessResponseSchema', () => {
    it('validates canonical web ready payload', () => {
      const payload = {
        status: 'ready',
        dependencies: {
          database: 'up',
          gateway: 'up',
          broker: 'up',
        },
      };
      const parsed = WebReadinessResponseSchema.parse(payload);
      expect(parsed.status).toBe('ready');
      expect(parsed.dependencies.database).toBe('up');
      expect(parsed.dependencies.gateway).toBe('up');
      expect(parsed.dependencies.broker).toBe('up');
    });

    it('validates web degraded payload', () => {
      const payload = {
        status: 'degraded',
        dependencies: {
          database: 'up',
          gateway: 'up',
          broker: 'down',
        },
      };
      const parsed = WebReadinessResponseSchema.parse(payload);
      expect(parsed.status).toBe('degraded');
    });

    it('rejects web payload missing gateway or broker dependency', () => {
      expect(() =>
        WebReadinessResponseSchema.parse({
          status: 'ready',
          dependencies: {
            database: 'up',
            gateway: 'up',
          },
        })
      ).toThrow();
    });
  });
});
