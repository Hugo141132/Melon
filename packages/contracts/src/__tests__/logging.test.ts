import { describe, expect, it } from 'vitest';
import { LogLevelSchema, LOG_LEVEL_PRIORITY, isLogLevelEnabled, formatLogRecord } from '../logging';

describe('Logging Contracts & Utilities', () => {
  describe('LogLevelSchema', () => {
    it('validates allowed log levels', () => {
      expect(LogLevelSchema.parse('debug')).toBe('debug');
      expect(LogLevelSchema.parse('info')).toBe('info');
      expect(LogLevelSchema.parse('warn')).toBe('warn');
      expect(LogLevelSchema.parse('error')).toBe('error');
    });

    it('rejects invalid log levels', () => {
      expect(() => LogLevelSchema.parse('trace')).toThrow();
      expect(() => LogLevelSchema.parse('fatal')).toThrow();
      expect(() => LogLevelSchema.parse('verbose')).toThrow();
    });

    it('defines monotonic priorities for all log levels', () => {
      expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
      expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
      expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
    });
  });

  describe('isLogLevelEnabled', () => {
    it('correctly filters levels based on priority', () => {
      // With 'info' configured:
      expect(isLogLevelEnabled('info', 'debug')).toBe(false);
      expect(isLogLevelEnabled('info', 'info')).toBe(true);
      expect(isLogLevelEnabled('info', 'warn')).toBe(true);
      expect(isLogLevelEnabled('info', 'error')).toBe(true);

      // With 'warn' configured:
      expect(isLogLevelEnabled('warn', 'debug')).toBe(false);
      expect(isLogLevelEnabled('warn', 'info')).toBe(false);
      expect(isLogLevelEnabled('warn', 'warn')).toBe(true);
      expect(isLogLevelEnabled('warn', 'error')).toBe(true);

      // With 'debug' configured:
      expect(isLogLevelEnabled('debug', 'debug')).toBe(true);
      expect(isLogLevelEnabled('debug', 'info')).toBe(true);
      expect(isLogLevelEnabled('debug', 'warn')).toBe(true);
      expect(isLogLevelEnabled('debug', 'error')).toBe(true);

      // With 'error' configured:
      expect(isLogLevelEnabled('error', 'debug')).toBe(false);
      expect(isLogLevelEnabled('error', 'info')).toBe(false);
      expect(isLogLevelEnabled('error', 'warn')).toBe(false);
      expect(isLogLevelEnabled('error', 'error')).toBe(true);
    });
  });

  describe('formatLogRecord', () => {
    it('formats a structured log record with service, environment, and timestamp', () => {
      const record = formatLogRecord('web', 'production', 'info', 'Server started');
      expect(record.service).toBe('web');
      expect(record.environment).toBe('production');
      expect(record.level).toBe('info');
      expect(record.message).toBe('Server started');
      expect(typeof record.timestamp).toBe('string');
      expect(record.meta).toBeUndefined();
      expect(record.error).toBeUndefined();
    });

    it('redacts sensitive fields in metadata', () => {
      const record = formatLogRecord('web', 'development', 'info', 'User login attempt', {
        requestId: 'req-123',
        username: 'operator',
        password: 'superSecretPassword!',
        token: 'jwt.token.here',
      });

      expect(record.meta).toEqual({
        requestId: 'req-123',
        username: 'operator',
        password: '[REDACTED]',
        token: '[REDACTED]',
      });
    });

    it('formats standard Error instances properly', () => {
      const error = new Error('Database connection timeout');
      const record = formatLogRecord(
        'iot-gateway',
        'production',
        'error',
        'Database error',
        { deviceId: 'dev-001' },
        error
      );

      expect(record.level).toBe('error');
      expect(record.error).toBeDefined();
      expect(typeof record.error).toBe('object');
      if (typeof record.error === 'object' && record.error !== null) {
        expect(record.error.name).toBe('Error');
        expect(record.error.message).toBe('Database connection timeout');
        expect(typeof record.error.stack).toBe('string');
      }
    });

    it('formats non-Error error values as strings', () => {
      const record = formatLogRecord(
        'iot-gateway',
        'staging',
        'error',
        'Unknown failure',
        undefined,
        'Something went wrong string'
      );

      expect(record.error).toBe('Something went wrong string');
    });
  });
});
