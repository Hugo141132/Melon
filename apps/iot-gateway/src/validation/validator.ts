import { z } from 'zod';

export type CanonicalErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_SCHEMA'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'UNKNOWN_DEVICE'
  | 'TOPIC_DEVICE_MISMATCH'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_VALUE'
  | 'MESSAGE_TOO_LARGE'
  | 'DUPLICATE_MESSAGE'
  | 'SEQUENCE_GAP'
  | 'DEVICE_OFFLINE'
  | 'BROKER_UNAVAILABLE'
  | 'COMMAND_EXPIRED'
  | 'COMMAND_REJECTED'
  | 'COMMAND_TIMEOUT'
  | 'COMMAND_STATE_CONFLICT';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const baseMessageSchema = z.object({
  schemaVersion: z.string().default('1.0'),
  messageId: z.string().uuid(),
  deviceId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  sequence: z.number().int().nonnegative().optional(),
});

export type BaseMessage = z.infer<typeof baseMessageSchema>;

export interface ValidationResult<T = BaseMessage> {
  valid: boolean;
  data?: T;
  errorCode?: CanonicalErrorCode;
  error?: string;
}

export interface MessageValidationOptions {
  topicDeviceId?: string;
  maxByteSize?: number;
  expectedSchemaVersion?: string;
}

export function hasNonFiniteNumbers(obj: unknown): boolean {
  if (typeof obj === 'number') {
    return !Number.isFinite(obj);
  }
  if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (hasNonFiniteNumbers((obj as Record<string, unknown>)[key])) {
        return true;
      }
    }
  }
  return false;
}

export class MessageValidator {
  public static readonly DEFAULT_MAX_BYTE_SIZE = 65536; // 64 KB default max payload size

  public validateBaseMessage(
    rawPayload: Buffer | string | null | undefined,
    options?: MessageValidationOptions
  ): ValidationResult<BaseMessage> {
    if (rawPayload === null || rawPayload === undefined) {
      return {
        valid: false,
        errorCode: 'INVALID_JSON',
        error: 'Payload must be a valid Buffer or string',
      };
    }

    const maxBytes = options?.maxByteSize ?? MessageValidator.DEFAULT_MAX_BYTE_SIZE;
    const byteLength = Buffer.isBuffer(rawPayload)
      ? rawPayload.length
      : Buffer.byteLength(String(rawPayload), 'utf-8');

    if (byteLength > maxBytes) {
      return {
        valid: false,
        errorCode: 'MESSAGE_TOO_LARGE',
        error: `Payload size (${byteLength} bytes) exceeds maximum allowed limit of ${maxBytes} bytes`,
      };
    }

    let parsed: any;
    try {
      const str = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf-8') : String(rawPayload);
      parsed = JSON.parse(str);
    } catch {
      return {
        valid: false,
        errorCode: 'INVALID_JSON',
        error: 'Payload must be valid JSON',
      };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        valid: false,
        errorCode: 'INVALID_SCHEMA',
        error: 'Payload must be a JSON object',
      };
    }

    if (hasNonFiniteNumbers(parsed)) {
      return {
        valid: false,
        errorCode: 'INVALID_VALUE',
        error: 'Payload contains non-finite numeric values (NaN or Infinity)',
      };
    }

    const rawSchemaVersion = parsed.schemaVersion;
    if (rawSchemaVersion === undefined || rawSchemaVersion === null || rawSchemaVersion === '') {
      return {
        valid: false,
        errorCode: 'INVALID_SCHEMA',
        error: 'Missing required field: schemaVersion',
      };
    }

    const expectedVersion = options?.expectedSchemaVersion ?? '1.0';
    if (String(rawSchemaVersion) !== expectedVersion) {
      return {
        valid: false,
        errorCode: 'UNSUPPORTED_SCHEMA_VERSION',
        error: `Unsupported schema version: expected '${expectedVersion}', received '${rawSchemaVersion}'`,
      };
    }

    if (typeof parsed.deviceId !== 'string' || parsed.deviceId.trim() === '') {
      return {
        valid: false,
        errorCode: 'INVALID_SCHEMA',
        error: 'Missing or invalid deviceId field',
      };
    }

    if (typeof parsed.messageId !== 'string' || !UUID_REGEX.test(parsed.messageId)) {
      return {
        valid: false,
        errorCode: 'INVALID_SCHEMA',
        error: 'Missing or invalid UUID messageId field',
      };
    }

    const timestampField = parsed.timestamp ?? parsed.recordedAt;
    if (typeof timestampField !== 'string') {
      return {
        valid: false,
        errorCode: 'INVALID_TIMESTAMP',
        error: 'Missing or invalid timestamp field',
      };
    }

    const date = new Date(timestampField);
    if (isNaN(date.getTime()) || (!timestampField.includes('T') && !timestampField.includes('Z'))) {
      return {
        valid: false,
        errorCode: 'INVALID_TIMESTAMP',
        error: `Timestamp '${timestampField}' is not a valid ISO 8601 string`,
      };
    }

    if (parsed.sequence !== undefined) {
      if (
        typeof parsed.sequence !== 'number' ||
        !Number.isInteger(parsed.sequence) ||
        parsed.sequence < 0
      ) {
        return {
          valid: false,
          errorCode: 'INVALID_SCHEMA',
          error: 'Sequence must be a non-negative integer',
        };
      }
    }

    if (options?.topicDeviceId && options.topicDeviceId !== parsed.deviceId) {
      return {
        valid: false,
        errorCode: 'TOPIC_DEVICE_MISMATCH',
        error: `Topic device ID ('${options.topicDeviceId}') does not match payload device ID ('${parsed.deviceId}')`,
      };
    }

    return {
      valid: true,
      data: parsed as BaseMessage,
    };
  }
}

export const messageValidator = new MessageValidator();
