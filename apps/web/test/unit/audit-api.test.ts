import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getAuditLogs } from '../../app/api/v1/audit-logs/route';
import { GET as getAuditLogById } from '../../app/api/v1/audit-logs/[auditId]/route';
import {
  recordAuditEvent,
  extractRequestMetadata,
  logAuthorizationDenial,
} from '../../lib/audit/audit-service';
import * as rbacModule from '../../lib/auth/rbac';
import { AuditRepository } from '@kebun-melon/database';
import { UserRole, AuditEventKey, AuditResult } from '@kebun-melon/contracts';
import { NextRequest } from 'next/server';

vi.mock('../../lib/auth/rbac', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireSession: vi.fn(),
    requirePermission: vi.fn(),
  };
});

vi.mock('@kebun-melon/database', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    AuditRepository: {
      createAuditLog: vi.fn(),
      findAuditLogs: vi.fn(),
      findAuditLogById: vi.fn(),
    },
  };
});

describe('Audit API Routes & Audit Service (TASK-0903)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractRequestMetadata', () => {
    it('extracts IP, User-Agent, and Request ID from Request headers', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
          'user-agent': 'TestBrowser/1.0',
          'x-request-id': 'req-xyz-123',
        },
      });

      const meta = extractRequestMetadata(req);
      expect(meta.ipAddress).toBe('203.0.113.195');
      expect(meta.userAgent).toBe('TestBrowser/1.0');
      expect(meta.requestId).toBe('req-xyz-123');
    });

    it('returns nulls when request headers are absent', () => {
      const meta = extractRequestMetadata();
      expect(meta.ipAddress).toBeNull();
      expect(meta.userAgent).toBeNull();
      expect(meta.requestId).toBeNull();
    });
  });

  describe('recordAuditEvent', () => {
    it('invokes AuditRepository.createAuditLog with extracted request metadata', async () => {
      const mockDto = {
        id: 'audit-001',
        eventKey: AuditEventKey.AUTH_LOGIN_SUCCESS,
        result: AuditResult.SUCCESS,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(AuditRepository.createAuditLog).mockResolvedValue(mockDto as any);

      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '198.51.100.1',
          'user-agent': 'VitestClient',
          'x-correlation-id': 'corr-999',
        },
      });

      const res = await recordAuditEvent(
        {
          eventKey: AuditEventKey.AUTH_LOGIN_SUCCESS,
          actorUserId: 'user-001',
          result: AuditResult.SUCCESS,
        },
        req
      );

      expect(res).toEqual(mockDto);
      expect(AuditRepository.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventKey: AuditEventKey.AUTH_LOGIN_SUCCESS,
          ipAddress: '198.51.100.1',
          userAgent: 'VitestClient',
          requestId: 'corr-999',
        })
      );
    });
  });

  describe('logAuthorizationDenial', () => {
    it('extracts IP, User-Agent, and Correlation ID from Request headers when recording authorization denial', async () => {
      const mockAudit = {
        id: 'audit-denied-001',
        eventKey: AuditEventKey.AUTHORISATION_HIGH_RISK_DENIED,
        result: AuditResult.DENIED,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(AuditRepository.createAuditLog).mockResolvedValue(mockAudit as any);

      const req = new Request('http://localhost/api/v1/devices/dev-123', {
        headers: {
          'x-forwarded-for': '203.0.113.88',
          'user-agent': 'RestrictedClient/2.0',
          'x-correlation-id': 'req-corr-403',
        },
      });

      const session = {
        id: 'admin-denied-user',
        activeRoles: [UserRole.ADMIN],
        accountStatus: 'ACTIVE',
      };

      await logAuthorizationDenial(session, 'device.delete', 'DEVICE', 'dev-123', req);

      expect(AuditRepository.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventKey: AuditEventKey.AUTHORISATION_HIGH_RISK_DENIED,
          actorUserId: 'admin-denied-user',
          actorRole: UserRole.ADMIN,
          targetType: 'DEVICE',
          targetId: 'dev-123',
          result: AuditResult.DENIED,
          ipAddress: '203.0.113.88',
          userAgent: 'RestrictedClient/2.0',
          requestId: 'req-corr-403',
          metadata: {
            permissionCode: 'device.delete',
            accountStatus: 'ACTIVE',
          },
        })
      );
    });
  });

  describe('GET /api/v1/audit-logs', () => {
    it('returns 401 UNAUTHORIZED if session is missing or invalid', async () => {
      vi.mocked(rbacModule.requireSession).mockRejectedValue(
        new rbacModule.AuthorizationError(401, 'UNAUTHENTICATED', 'Session is required')
      );

      const req = new NextRequest('http://localhost/api/v1/audit-logs');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 FORBIDDEN if user lacks audit.read permission', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValue({
        id: 'admin-001',
        fullName: 'Admin User',
        email: 'admin@example.com',
        accountStatus: 'ACTIVE' as any,
        activeRoles: [UserRole.ADMIN],
      });

      vi.mocked(rbacModule.requirePermission).mockImplementation(() => {
        throw new rbacModule.AuthorizationError(
          403,
          'INSUFFICIENT_PERMISSION',
          "Missing permission 'audit.read'"
        );
      });

      const req = new NextRequest('http://localhost/api/v1/audit-logs');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('returns 200 with paginated audit logs for authorized OWNER user', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValue({
        id: 'owner-001',
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: 'ACTIVE' as any,
        activeRoles: [UserRole.OWNER],
      });

      vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

      const mockItems = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          eventKey: AuditEventKey.ACCOUNT_APPROVED,
          actorUserId: 'owner-001',
          actorRole: UserRole.OWNER,
          targetType: 'USER',
          targetId: '123e4567-e89b-12d3-a456-426614174002',
          result: AuditResult.SUCCESS,
          previousValues: null,
          newValues: null,
          metadata: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(AuditRepository.findAuditLogs).mockResolvedValue({
        items: mockItems,
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const req = new NextRequest('http://localhost/api/v1/audit-logs?page=1&pageSize=20');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockItems);
      expect(json.pagination.totalCount).toBe(1);
    });
  });

  describe('GET /api/v1/audit-logs/[auditId]', () => {
    it('returns 404 AUDIT_LOG_NOT_FOUND if audit log ID does not exist', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValue({
        id: 'owner-001',
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: 'ACTIVE' as any,
        activeRoles: [UserRole.OWNER],
      });

      vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);
      vi.mocked(AuditRepository.findAuditLogById).mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/v1/audit-logs/non-existent-id');
      const res = await getAuditLogById(req, {
        params: Promise.resolve({ auditId: 'non-existent-id' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('AUDIT_LOG_NOT_FOUND');
    });

    it('returns 200 with single audit log record when found', async () => {
      vi.mocked(rbacModule.requireSession).mockResolvedValue({
        id: 'owner-001',
        fullName: 'Owner User',
        email: 'owner@example.com',
        accountStatus: 'ACTIVE' as any,
        activeRoles: [UserRole.OWNER],
      });

      vi.mocked(rbacModule.requirePermission).mockReturnValue({} as any);

      const mockDto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventKey: AuditEventKey.ACCOUNT_APPROVED,
        actorUserId: 'owner-001',
        result: AuditResult.SUCCESS,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(AuditRepository.findAuditLogById).mockResolvedValue(mockDto as any);

      const req = new NextRequest(
        'http://localhost/api/v1/audit-logs/123e4567-e89b-12d3-a456-426614174000'
      );
      const res = await getAuditLogById(req, {
        params: Promise.resolve({ auditId: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});
