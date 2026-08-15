import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../observability/logger';

describe('IoT Gateway Logger (TASK-0904)', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats structured log records with timestamp, service: iot-gateway, environment, level, and message', () => {
    const logger = new Logger({
      serviceName: 'iot-gateway',
      environment: 'production',
      minLevel: 'info',
    });

    const record = logger.format('info', 'Gateway MQTT connected');

    expect(record.service).toBe('iot-gateway');
    expect(record.environment).toBe('production');
    expect(record.level).toBe('info');
    expect(record.message).toBe('Gateway MQTT connected');
    expect(typeof record.timestamp).toBe('string');
  });

  it('supports constructor with string service name', () => {
    const logger = new Logger('iot-gateway-worker');
    expect(logger.getServiceName()).toBe('iot-gateway-worker');
    expect(logger.getMinLevel()).toBe('info');
  });

  it('filters log levels based on configured minLevel', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development'; // allow console emission to be spied

    try {
      const logger = new Logger({
        serviceName: 'iot-gateway',
        environment: 'development',
        minLevel: 'warn',
      });

      logger.debug('Debug log');
      logger.info('Info log');
      logger.warn('Warn log');
      logger.error('Error log');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('redacts sensitive fields from gateway metadata', () => {
    const logger = new Logger({
      serviceName: 'iot-gateway',
      environment: 'production',
      minLevel: 'info',
    });

    const record = logger.format('info', 'MQTT broker configuration', {
      brokerUrl: 'mqtts://broker.emqx.io:8883',
      mqtt_gateway_password: 'superSecretPassword',
      token: 'jwt-auth-token',
      deviceId: 'water-tank-01',
    });

    expect(record.meta).toEqual({
      brokerUrl: 'mqtts://broker.emqx.io:8883',
      mqtt_gateway_password: '[REDACTED]',
      token: '[REDACTED]',
      deviceId: 'water-tank-01',
    });
  });

  it('formats Error objects in error logs with name, message, stack', () => {
    const logger = new Logger({
      serviceName: 'iot-gateway',
      environment: 'production',
      minLevel: 'error',
    });

    const err = new Error('MQTT connection dropped');
    const record = logger.format('error', 'Broker failure', { retryCount: 3 }, err);

    expect(record.level).toBe('error');
    expect(record.message).toBe('Broker failure');
    expect(record.meta).toEqual({ retryCount: 3 });
    expect(record.error).toBeDefined();
    if (typeof record.error === 'object' && record.error !== null) {
      expect(record.error.name).toBe('Error');
      expect(record.error.message).toBe('MQTT connection dropped');
      expect(typeof record.error.stack).toBe('string');
    }
  });

  it('supports child context propagation', () => {
    const parentLogger = new Logger({
      serviceName: 'iot-gateway',
      environment: 'production',
      minLevel: 'info',
      defaultMeta: { serviceInstance: 'gw-1' },
    });

    const childLogger = parentLogger.child({
      deviceId: 'soil-node-01',
      correlationId: 'corr-555',
    });

    const record = childLogger.format('info', 'Telemetry packet parsed', { sequence: 42 });

    expect(record.meta).toEqual({
      serviceInstance: 'gw-1',
      deviceId: 'soil-node-01',
      correlationId: 'corr-555',
      sequence: 42,
    });
  });
});
