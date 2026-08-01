import { redactSecrets } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  correlationId?: string;
  messageId?: string;
  commandId?: string;
  deviceId?: string;
  ingestionId?: string;
  requestId?: string;
  topic?: string;
  [key: string]: unknown;
}

export class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'iot-gateway') {
    this.serviceName = serviceName;
  }

  private formatMessage(level: LogLevel, message: string, meta?: LogMeta) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? redactSecrets(meta) : undefined;

    return JSON.stringify({
      timestamp,
      service: this.serviceName,
      level,
      message,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    });
  }

  debug(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta: LogMeta = { ...meta };
    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorMeta.error = String(error);
    }

    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('error', message, errorMeta));
    }
  }
}

export const logger = new Logger('iot-gateway');
