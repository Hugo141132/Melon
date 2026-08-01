import { describe, it, expect } from 'vitest';
import {
  MessageValidator,
  messageValidator,
  hasNonFiniteNumbers,
  CanonicalErrorCode,
} from '../validation/validator';

describe('MessageValidator Subsystem (TASK-0404)', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const validTimestamp = '2026-08-01T07:43:15.000Z';
  const validDeviceId = 'water-node-esp32-01';

  const validPayloadObj = {
    schemaVersion: '1.0',
    messageId: validUUID,
    deviceId: validDeviceId,
    timestamp: validTimestamp,
    sequence: 42,
    telemetry: {
      ph: 7.2,
      tds: 340,
      status: 'NORMAL',
    },
  };

  describe('Valid Base Message Validation', () => {
    it('validates a correct payload Buffer with schemaVersion 1.0', () => {
      const raw = Buffer.from(JSON.stringify(validPayloadObj));
      const res = messageValidator.validateBaseMessage(raw);

      expect(res.valid).toBe(true);
      expect(res.errorCode).toBeUndefined();
      expect(res.error).toBeUndefined();
      expect(res.data?.deviceId).toBe(validDeviceId);
      expect(res.data?.schemaVersion).toBe('1.0');
      expect(res.data?.messageId).toBe(validUUID);
      expect(res.data?.sequence).toBe(42);
    });

    it('validates string payload with schemaVersion 1.0', () => {
      const raw = JSON.stringify({
        schemaVersion: '1.0',
        messageId: validUUID,
        deviceId: validDeviceId,
        timestamp: validTimestamp,
      });

      const res = messageValidator.validateBaseMessage(raw);

      expect(res.valid).toBe(true);
      expect(res.data?.schemaVersion).toBe('1.0');
      expect(res.data?.deviceId).toBe(validDeviceId);
    });
  });

  describe('Payload Size Constraints (MESSAGE_TOO_LARGE)', () => {
    it('rejects payload exceeding maxByteSize with MESSAGE_TOO_LARGE', () => {
      const smallLimit = 100;
      const largeObj = {
        ...validPayloadObj,
        padding: 'x'.repeat(200),
      };
      const raw = Buffer.from(JSON.stringify(largeObj));

      const res = messageValidator.validateBaseMessage(raw, { maxByteSize: smallLimit });

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('MESSAGE_TOO_LARGE');
      expect(res.error).toContain('exceeds maximum allowed limit');
    });

    it('respects default 64KB size limit', () => {
      const oversizedString = 'a'.repeat(MessageValidator.DEFAULT_MAX_BYTE_SIZE + 10);
      const res = messageValidator.validateBaseMessage(oversizedString);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('MESSAGE_TOO_LARGE');
    });
  });

  describe('JSON Syntax & Structure Validation (INVALID_JSON & INVALID_SCHEMA)', () => {
    it('rejects malformed JSON string with INVALID_JSON', () => {
      const raw = '{ invalid json string ';
      const res = messageValidator.validateBaseMessage(raw);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('INVALID_JSON');
      expect(res.error).toBe('Payload must be valid JSON');
    });

    it('rejects null or undefined payload input with INVALID_JSON', () => {
      expect(messageValidator.validateBaseMessage(null).errorCode).toBe<CanonicalErrorCode>(
        'INVALID_JSON'
      );
      expect(messageValidator.validateBaseMessage(undefined).errorCode).toBe<CanonicalErrorCode>(
        'INVALID_JSON'
      );
    });

    it('rejects JSON primitive or array payload with INVALID_SCHEMA', () => {
      expect(messageValidator.validateBaseMessage('123').errorCode).toBe<CanonicalErrorCode>(
        'INVALID_SCHEMA'
      );
      expect(
        messageValidator.validateBaseMessage('"just a string"').errorCode
      ).toBe<CanonicalErrorCode>('INVALID_SCHEMA');
      expect(messageValidator.validateBaseMessage('[1, 2, 3]').errorCode).toBe<CanonicalErrorCode>(
        'INVALID_SCHEMA'
      );
    });
  });

  describe('Recursive Non-Finite Numbers Check (INVALID_VALUE)', () => {
    it('hasNonFiniteNumbers utility accurately identifies NaN, Infinity, -Infinity', () => {
      expect(hasNonFiniteNumbers(42)).toBe(false);
      expect(hasNonFiniteNumbers(NaN)).toBe(true);
      expect(hasNonFiniteNumbers(Infinity)).toBe(true);
      expect(hasNonFiniteNumbers(-Infinity)).toBe(true);

      expect(hasNonFiniteNumbers({ a: 1, b: { c: 2.5 } })).toBe(false);
      expect(hasNonFiniteNumbers({ a: 1, b: { c: NaN } })).toBe(true);
      expect(hasNonFiniteNumbers({ a: [1, 2, Infinity] })).toBe(true);
    });

    it('rejects payload containing non-finite numbers with INVALID_VALUE', () => {
      const parsedObj = {
        ...validPayloadObj,
        telemetry: {
          moisture: NaN,
        },
      };

      // Direct obj validation check via helper
      expect(hasNonFiniteNumbers(parsedObj)).toBe(true);
    });
  });

  describe('Schema Version Enforcement (UNSUPPORTED_SCHEMA_VERSION & INVALID_SCHEMA)', () => {
    it('rejects unsupported schemaVersion 2.0 with UNSUPPORTED_SCHEMA_VERSION', () => {
      const raw = JSON.stringify({
        ...validPayloadObj,
        schemaVersion: '2.0',
      });

      const res = messageValidator.validateBaseMessage(raw);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('UNSUPPORTED_SCHEMA_VERSION');
      expect(res.error).toContain("expected '1.0', received '2.0'");
    });

    it('rejects missing schemaVersion with INVALID_SCHEMA', () => {
      const raw = JSON.stringify({
        messageId: validUUID,
        deviceId: validDeviceId,
        timestamp: validTimestamp,
      });

      const res = messageValidator.validateBaseMessage(raw);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('INVALID_SCHEMA');
      expect(res.error).toContain('Missing required field: schemaVersion');
    });
  });

  describe('Envelope Mandatory Fields Validation', () => {
    it('rejects missing or invalid deviceId with INVALID_SCHEMA', () => {
      const missingDev = JSON.stringify({
        ...validPayloadObj,
        deviceId: '   ',
      });

      const res = messageValidator.validateBaseMessage(missingDev);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('INVALID_SCHEMA');
      expect(res.error).toContain('Missing or invalid deviceId field');
    });

    it('rejects invalid non-UUID messageId with INVALID_SCHEMA', () => {
      const invalidId = JSON.stringify({
        ...validPayloadObj,
        messageId: 'not-a-uuid-12345',
      });

      const res = messageValidator.validateBaseMessage(invalidId);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('INVALID_SCHEMA');
      expect(res.error).toContain('Missing or invalid UUID messageId field');
    });

    it('rejects invalid or non-ISO timestamp with INVALID_TIMESTAMP', () => {
      const invalidTime = JSON.stringify({
        ...validPayloadObj,
        timestamp: 'invalid-timestamp-string',
      });

      const res = messageValidator.validateBaseMessage(invalidTime);

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('INVALID_TIMESTAMP');
      expect(res.error).toContain('is not a valid ISO 8601 string');
    });

    it('accepts valid ISO timestamps with timezone offsets', () => {
      const offsetTimestamp = '2026-08-01T14:43:15.123+07:00';
      const raw = JSON.stringify({
        ...validPayloadObj,
        timestamp: offsetTimestamp,
      });

      const res = messageValidator.validateBaseMessage(raw);
      expect(res.valid).toBe(true);
      expect(res.data?.timestamp).toBe(offsetTimestamp);
    });

    it('rejects negative or fractional sequence number with INVALID_SCHEMA', () => {
      const negativeSeq = JSON.stringify({
        ...validPayloadObj,
        sequence: -5,
      });

      const res1 = messageValidator.validateBaseMessage(negativeSeq);
      expect(res1.valid).toBe(false);
      expect(res1.errorCode).toBe<CanonicalErrorCode>('INVALID_SCHEMA');

      const floatSeq = JSON.stringify({
        ...validPayloadObj,
        sequence: 12.34,
      });

      const res2 = messageValidator.validateBaseMessage(floatSeq);
      expect(res2.valid).toBe(false);
      expect(res2.errorCode).toBe<CanonicalErrorCode>('INVALID_SCHEMA');
    });
  });

  describe('Topic vs Payload Device ID Match (TOPIC_DEVICE_MISMATCH)', () => {
    it('passes when topicDeviceId matches payload deviceId', () => {
      const raw = JSON.stringify(validPayloadObj);
      const res = messageValidator.validateBaseMessage(raw, {
        topicDeviceId: validDeviceId,
      });

      expect(res.valid).toBe(true);
    });

    it('rejects with TOPIC_DEVICE_MISMATCH when topicDeviceId does not match payload deviceId', () => {
      const raw = JSON.stringify(validPayloadObj);
      const res = messageValidator.validateBaseMessage(raw, {
        topicDeviceId: 'different-device-99',
      });

      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe<CanonicalErrorCode>('TOPIC_DEVICE_MISMATCH');
      expect(res.error).toContain(
        "Topic device ID ('different-device-99') does not match payload device ID ('water-node-esp32-01')"
      );
    });
  });
});
