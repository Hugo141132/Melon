import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import {
  AuditLogDto,
  AuditLogQuery,
  CreateAuditLogInput,
  redactSecrets,
} from '@kebun-melon/contracts';

/**
 * Result structure for paginated audit log queries
 */
export interface PaginatedAuditLogs {
  items: AuditLogDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Repository for append-only AuditLog persistence and querying.
 * Follows SEC-LOG-001, DB-AUDIT-001, API-AUDIT-001 specifications.
 */
export class AuditRepository {
  /**
   * Appends a new AuditLog entry in PostgreSQL.
   * Automatically redacts sensitive fields from previousValues, newValues, and metadata.
   */
  static async createAuditLog(
    prismaOrTx: PrismaClient | Prisma.TransactionClient,
    input: CreateAuditLogInput
  ): Promise<AuditLogDto> {
    const sanitizedPrevious = input.previousValues ? redactSecrets(input.previousValues) : null;
    const sanitizedNew = input.newValues ? redactSecrets(input.newValues) : null;
    const sanitizedMeta = input.metadata ? redactSecrets(input.metadata) : null;

    const record = await prismaOrTx.auditLog.create({
      data: {
        eventKey: input.eventKey,
        actorUserId: input.actorUserId || null,
        actorRole: input.actorRole ? (input.actorRole as UserRole) : null,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        result: input.result,
        previousValues: sanitizedPrevious
          ? (sanitizedPrevious as Prisma.InputJsonValue)
          : Prisma.DbNull,
        newValues: sanitizedNew ? (sanitizedNew as Prisma.InputJsonValue) : Prisma.DbNull,
        metadata: sanitizedMeta ? (sanitizedMeta as Prisma.InputJsonValue) : Prisma.DbNull,
        requestId: input.requestId || null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });

    return this.mapToDto(record);
  }

  /**
   * Queries audit logs with pagination and filters.
   * Sorted by createdAt DESC.
   */
  static async findAuditLogs(
    prismaOrTx: PrismaClient | Prisma.TransactionClient,
    query: AuditLogQuery
  ): Promise<PaginatedAuditLogs> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.eventKey) {
      where.eventKey = query.eventKey;
    }

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.targetType) {
      where.targetType = query.targetType;
    }

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.result) {
      where.result = query.result;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [records, totalCount] = await Promise.all([
      prismaOrTx.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prismaOrTx.auditLog.count({ where }),
    ]);

    const items = records.map((record) => this.mapToDto(record));

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  /**
   * Finds a single audit log by ID.
   */
  static async findAuditLogById(
    prismaOrTx: PrismaClient | Prisma.TransactionClient,
    auditId: string
  ): Promise<AuditLogDto | null> {
    const record = await prismaOrTx.auditLog.findUnique({
      where: { id: auditId },
    });

    if (!record) {
      return null;
    }

    return this.mapToDto(record);
  }

  /**
   * Helper to map Prisma AuditLog model to public AuditLogDto
   */
  private static mapToDto(record: any): AuditLogDto {
    return {
      id: record.id,
      eventKey: record.eventKey,
      actorUserId: record.actorUserId ?? null,
      actorRole: (record.actorRole as any) ?? null,
      targetType: record.targetType ?? null,
      targetId: record.targetId ?? null,
      result: record.result,
      previousValues: (record.previousValues as Record<string, unknown>) ?? null,
      newValues: (record.newValues as Record<string, unknown>) ?? null,
      metadata: (record.metadata as Record<string, unknown>) ?? null,
      requestId: record.requestId ?? null,
      ipAddress: record.ipAddress ?? null,
      userAgent: record.userAgent ?? null,
      createdAt:
        record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  }
}
