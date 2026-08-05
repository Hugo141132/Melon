import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditRepository } from '../src/audit-repository';
import { AuditEventKey, AuditResult, UserRole } from '@kebun-melon/contracts';

describe('AuditRepository Unit Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
    };
  });

  describe('createAuditLog', () => {
    it('creates an audit log entry with secret redaction and maps fields correctly', async () => {
      const mockRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        actorUserId: '123e4567-e89b-12d3-a456-426614174001',
        actorRole: 'OWNER',
        targetType: 'USER',
        targetId: '123e4567-e89b-12d3-a456-426614174002',
        result: AuditResult.SUCCESS,
        previousValues: { accountStatus: 'PENDING_APPROVAL' },
        newValues: { accountStatus: 'ACTIVE' },
        metadata: { decisionNote: 'Approved by Owner' },
        requestId: 'req-123',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
        createdAt: new Date('2026-08-05T10:00:00Z'),
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockRecord);

      const input = {
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        actorUserId: '123e4567-e89b-12d3-a456-426614174001',
        actorRole: UserRole.OWNER,
        targetType: 'USER',
        targetId: '123e4567-e89b-12d3-a456-426614174002',
        result: AuditResult.SUCCESS,
        previousValues: { accountStatus: 'PENDING_APPROVAL', secretToken: 'rawSecret123' },
        newValues: { accountStatus: 'ACTIVE' },
        metadata: { passwordHash: 'hashToRedact' },
        requestId: 'req-123',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      const result = await AuditRepository.createAuditLog(mockPrisma, input);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const createArgs = mockPrisma.auditLog.create.mock.calls[0][0].data;

      // Verify secret redaction before Prisma creation
      expect(createArgs.previousValues).toEqual({
        accountStatus: 'PENDING_APPROVAL',
        secretToken: '[REDACTED]',
      });
      expect(createArgs.metadata).toEqual({
        passwordHash: '[REDACTED]',
      });

      expect(result.id).toBe(mockRecord.id);
      expect(result.eventKey).toBe(AuditEventKey.ACCOUNT_APPROVED);
      expect(result.createdAt).toBe('2026-08-05T10:00:00.000Z');
    });
  });

  describe('findAuditLogs', () => {
    it('queries audit logs with pagination and filters', async () => {
      const mockRecords = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          eventKey: AuditEventKey.ACCOUNT_APPROVED,
          actorUserId: '123e4567-e89b-12d3-a456-426614174001',
          actorRole: 'OWNER',
          targetType: 'USER',
          targetId: '123e4567-e89b-12d3-a456-426614174002',
          result: 'SUCCESS',
          previousValues: null,
          newValues: null,
          metadata: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date('2026-08-05T10:00:00Z'),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockRecords);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const query = {
        page: 1,
        pageSize: 10,
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-06T00:00:00.000Z',
      };

      const result = await AuditRepository.findAuditLogs(mockPrisma, query);

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          eventKey: AuditEventKey.ACCOUNT_APPROVED,
          createdAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lte: new Date('2026-08-06T00:00:00.000Z'),
          },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAuditLogById', () => {
    it('returns AuditLogDto if record exists', async () => {
      const mockRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        result: 'SUCCESS',
        createdAt: new Date('2026-08-05T10:00:00Z'),
      };

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockRecord);

      const result = await AuditRepository.findAuditLogById(
        mockPrisma,
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('returns null if record does not exist', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      const result = await AuditRepository.findAuditLogById(
        mockPrisma,
        '123e4567-e89b-12d3-a456-426614174999'
      );

      expect(result).toBeNull();
    });
  });
});
