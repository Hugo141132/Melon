import { describe, expect, it } from 'vitest';
import {
  redactSecrets,
  AuditLogDtoSchema,
  AuditLogQuerySchema,
  AuditEventKey,
  AuditResult,
} from '../audit';
import { UserRole } from '../enums';

describe('Audit Contracts & Utilities', () => {
  describe('redactSecrets', () => {
    it('returns null and undefined as-is', () => {
      expect(redactSecrets(null)).toBeNull();
      expect(redactSecrets(undefined)).toBeUndefined();
    });

    it('returns primitive values as-is', () => {
      expect(redactSecrets('hello')).toBe('hello');
      expect(redactSecrets(123)).toBe(123);
      expect(redactSecrets(true)).toBe(true);
    });

    it('redacts top-level sensitive keys', () => {
      const input = {
        username: 'johndoe',
        password: 'secretPassword123!',
        passwordHash: '$argon2id$v=19...',
        sessionToken: 'xyz789',
        secretKey: 'my-secret',
        apiKey: 'api-12345',
        bearerToken: 'bearer-token-value',
        cookie: 'session=123',
        normalField: 'safeValue',
      };

      const sanitized = redactSecrets(input);

      expect(sanitized).toEqual({
        username: 'johndoe',
        password: '[REDACTED]',
        passwordHash: '[REDACTED]',
        sessionToken: '[REDACTED]',
        secretKey: '[REDACTED]',
        apiKey: '[REDACTED]',
        bearerToken: '[REDACTED]',
        cookie: '[REDACTED]',
        normalField: 'safeValue',
      });
    });

    it('recursively redacts nested objects and arrays', () => {
      const input = {
        user: {
          id: 'user-1',
          credentials: {
            passwordHash: 'secret-hash',
          },
          securityInfo: {
            passwordHash: 'secret-hash',
            privateKey: 'pem-data',
            loginCount: 5,
          },
        },
        deviceList: [
          { deviceId: 'dev-1', deviceSecret: 'supersecret' },
          { deviceId: 'dev-2', authHeader: 'Bearer token' },
        ],
      };

      const sanitized = redactSecrets(input);

      expect(sanitized).toEqual({
        user: {
          id: 'user-1',
          credentials: '[REDACTED]',
          securityInfo: {
            passwordHash: '[REDACTED]',
            privateKey: '[REDACTED]',
            loginCount: 5,
          },
        },
        deviceList: [
          { deviceId: 'dev-1', deviceSecret: '[REDACTED]' },
          { deviceId: 'dev-2', authHeader: '[REDACTED]' },
        ],
      });
    });
  });

  describe('AuditLogDtoSchema', () => {
    it('validates a valid AuditLogDto object', () => {
      const validDto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        actorUserId: '123e4567-e89b-12d3-a456-426614174001',
        actorRole: UserRole.OWNER,
        targetType: 'USER',
        targetId: '123e4567-e89b-12d3-a456-426614174002',
        result: AuditResult.SUCCESS,
        previousValues: { accountStatus: 'PENDING_APPROVAL' },
        newValues: { accountStatus: 'ACTIVE' },
        metadata: { decisionNote: 'Approved by Owner' },
        requestId: 'req-001',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date().toISOString(),
      };

      const result = AuditLogDtoSchema.safeParse(validDto);
      expect(result.success).toBe(true);
    });

    it('fails when id is not a valid UUID', () => {
      const invalidDto = {
        id: 'invalid-id',
        eventKey: 'account.approved',
        result: 'SUCCESS',
        createdAt: new Date().toISOString(),
      };

      const result = AuditLogDtoSchema.safeParse(invalidDto);
      expect(result.success).toBe(false);
    });
  });

  describe('AuditLogQuerySchema', () => {
    it('parses valid query parameters and applies defaults', () => {
      const parsed = AuditLogQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });

    it('coerces string page and pageSize numbers', () => {
      const parsed = AuditLogQuerySchema.parse({
        page: '2',
        pageSize: '50',
        eventKey: 'account.approved',
      });
      expect(parsed.page).toBe(2);
      expect(parsed.pageSize).toBe(50);
      expect(parsed.eventKey).toBe('account.approved');
    });
  });
});
