import { z } from 'zod';
import { redactSecrets } from './audit';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function isLogLevelEnabled(configuredLevel: LogLevel, targetLevel: LogLevel): boolean {
  const configuredPriority = LOG_LEVEL_PRIORITY[configuredLevel] ?? LOG_LEVEL_PRIORITY.info;
  const targetPriority = LOG_LEVEL_PRIORITY[targetLevel] ?? LOG_LEVEL_PRIORITY.info;
  return targetPriority >= configuredPriority;
}

export interface LogMeta {
  correlationId?: string;
  requestId?: string;
  messageId?: string;
  commandId?: string;
  deviceId?: string;
  userId?: string;
  actorUserId?: string;
  action?: string;
  topic?: string;
  ingestionId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  [key: string]: unknown;
}

export interface FormattedError {
  name?: string;
  message: string;
  stack?: string;
  [key: string]: unknown;
}

export interface StructuredLogRecord {
  timestamp: string;
  service: string;
  environment: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  error?: FormattedError | string;
}

export function formatLogRecord(
  service: string,
  environment: string,
  level: LogLevel,
  message: string,
  meta?: LogMeta,
  error?: Error | unknown
): StructuredLogRecord {
  const timestamp = new Date().toISOString();
  const sanitizedMeta =
    meta && Object.keys(meta).length > 0
      ? (redactSecrets(meta) as Record<string, unknown>)
      : undefined;

  const record: StructuredLogRecord = {
    timestamp,
    service,
    environment,
    level,
    message,
  };

  if (sanitizedMeta) {
    record.meta = sanitizedMeta;
  }

  if (error !== undefined && error !== null) {
    if (error instanceof Error) {
      record.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      record.error = String(error);
    }
  }

  return record;
}
