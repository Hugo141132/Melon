import {
  LogLevel,
  LogMeta,
  StructuredLogRecord,
  isLogLevelEnabled,
  formatLogRecord,
} from '@kebun-melon/contracts';

export interface LoggerOptions {
  serviceName?: string;
  environment?: string;
  minLevel?: LogLevel;
  defaultMeta?: LogMeta;
}

export class Logger {
  private serviceName: string;
  private environment: string;
  private minLevel: LogLevel;
  private defaultMeta?: LogMeta;

  constructor(options?: LoggerOptions) {
    this.serviceName = options?.serviceName ?? 'web';
    this.environment =
      options?.environment ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.minLevel =
      options?.minLevel ??
      (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel) ? envLevel : 'info');

    this.defaultMeta = options?.defaultMeta;
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public getMinLevel(): LogLevel {
    return this.minLevel;
  }

  public getServiceName(): string {
    return this.serviceName;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public child(contextMeta: LogMeta): Logger {
    return new Logger({
      serviceName: this.serviceName,
      environment: this.environment,
      minLevel: this.minLevel,
      defaultMeta: { ...this.defaultMeta, ...contextMeta },
    });
  }

  public format(
    level: LogLevel,
    message: string,
    meta?: LogMeta,
    error?: Error | unknown
  ): StructuredLogRecord {
    const mergedMeta = this.defaultMeta || meta ? { ...this.defaultMeta, ...meta } : undefined;

    return formatLogRecord(this.serviceName, this.environment, level, message, mergedMeta, error);
  }

  public debug(message: string, meta?: LogMeta): void {
    if (!isLogLevelEnabled(this.minLevel, 'debug')) return;
    const record = this.format('debug', message, meta);
    console.debug(JSON.stringify(record));
  }

  public info(message: string, meta?: LogMeta): void {
    if (!isLogLevelEnabled(this.minLevel, 'info')) return;
    const record = this.format('info', message, meta);
    console.log(JSON.stringify(record));
  }

  public warn(message: string, meta?: LogMeta): void {
    if (!isLogLevelEnabled(this.minLevel, 'warn')) return;
    const record = this.format('warn', message, meta);
    console.warn(JSON.stringify(record));
  }

  public error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    if (!isLogLevelEnabled(this.minLevel, 'error')) return;
    const record = this.format('error', message, meta, error);
    console.error(JSON.stringify(record));
  }
}

export const logger = new Logger({ serviceName: 'web' });
export { type LogLevel, type LogMeta, type StructuredLogRecord } from '@kebun-melon/contracts';
