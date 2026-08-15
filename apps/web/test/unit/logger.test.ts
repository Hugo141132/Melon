import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/observability/logger';

describe('Web Application Logger (TASK-0904)', () => {
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

  it('formats structured log records with timestamp, service, environment, level, and message', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'staging',
      minLevel: 'info',
    });

    const record = logger.format('info', 'Test log message');

    expect(record.service).toBe('web');
    expect(record.environment).toBe('staging');
    expect(record.level).toBe('info');
    expect(record.message).toBe('Test log message');
    expect(typeof record.timestamp).toBe('string');
    expect(isNaN(Date.parse(record.timestamp))).toBe(false);
  });

  it('enforces configurable log level filtering', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'development',
      minLevel: 'warn',
    });

    logger.debug('Debug message should not be emitted');
    logger.info('Info message should not be emitted');
    logger.warn('Warn message should be emitted');
    logger.error('Error message should be emitted');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const warnPayload = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
    expect(warnPayload.level).toBe('warn');
    expect(warnPayload.message).toBe('Warn message should be emitted');

    const errorPayload = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(errorPayload.level).toBe('error');
    expect(errorPayload.message).toBe('Error message should be emitted');
  });

  it('includes correlation IDs and metadata in structured logs', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'production',
      minLevel: 'info',
    });

    logger.info('Operation performed', {
      correlationId: 'corr-xyz-123',
      requestId: 'req-abc-789',
      deviceId: 'soil-node-01',
      userId: 'user-uuid-456',
      action: 'device.telemetry.ingest',
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(parsed.meta).toEqual({
      correlationId: 'corr-xyz-123',
      requestId: 'req-abc-789',
      deviceId: 'soil-node-01',
      userId: 'user-uuid-456',
      action: 'device.telemetry.ingest',
    });
  });

  it('redacts sensitive fields, credentials, and tokens from metadata', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'production',
      minLevel: 'info',
    });

    logger.info('Authentication attempt', {
      requestId: 'req-auth-1',
      username: 'admin_user',
      password: 'PlainSecretPassword123!',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$...',
      sessionToken: 'secret-session-token-xyz',
      apiKey: 'api-key-value',
      bearerToken: 'Bearer eyJhbGciOi...',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...',
      cookie: 'kebun_session=xyz',
      authHeader: 'Bearer token-abc',
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(parsed.meta.username).toBe('admin_user');
    expect(parsed.meta.requestId).toBe('req-auth-1');
    expect(parsed.meta.password).toBe('[REDACTED]');
    expect(parsed.meta.passwordHash).toBe('[REDACTED]');
    expect(parsed.meta.sessionToken).toBe('[REDACTED]');
    expect(parsed.meta.apiKey).toBe('[REDACTED]');
    expect(parsed.meta.bearerToken).toBe('[REDACTED]');
    expect(parsed.meta.privateKey).toBe('[REDACTED]');
    expect(parsed.meta.cookie).toBe('[REDACTED]');
    expect(parsed.meta.authHeader).toBe('[REDACTED]');
  });

  it('serializes Error instances with name, message, and stack trace in error logs', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'test',
      minLevel: 'error',
    });

    const testError = new Error('Database pool exhaustion');
    logger.error('Failed to execute query', testError, {
      requestId: 'req-db-001',
      query: 'SELECT 1',
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Failed to execute query');
    expect(parsed.error).toBeDefined();
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.message).toBe('Database pool exhaustion');
    expect(typeof parsed.error.stack).toBe('string');
    expect(parsed.meta).toEqual({
      requestId: 'req-db-001',
      query: 'SELECT 1',
    });
  });

  it('supports child loggers with inherited context metadata', () => {
    const rootLogger = new Logger({
      serviceName: 'web',
      environment: 'production',
      minLevel: 'info',
    });

    const requestLogger = rootLogger.child({
      requestId: 'req-100',
      correlationId: 'corr-200',
    });

    requestLogger.info('Step 1 complete', { step: 1 });
    requestLogger.info('Step 2 complete', { step: 2 });

    expect(consoleLogSpy).toHaveBeenCalledTimes(2);

    const call1 = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(call1.meta).toEqual({
      requestId: 'req-100',
      correlationId: 'corr-200',
      step: 1,
    });

    const call2 = JSON.parse(consoleLogSpy.mock.calls[1][0]);
    expect(call2.meta).toEqual({
      requestId: 'req-100',
      correlationId: 'corr-200',
      step: 2,
    });
  });

  it('allows dynamic log level adjustment via setMinLevel', () => {
    const logger = new Logger({
      serviceName: 'web',
      environment: 'production',
      minLevel: 'error',
    });

    logger.info('Should be ignored initially');
    expect(consoleLogSpy).not.toHaveBeenCalled();

    logger.setMinLevel('info');
    expect(logger.getMinLevel()).toBe('info');

    logger.info('Should be logged after setMinLevel');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });
});
