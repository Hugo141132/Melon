import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateFaucetCommandInput,
  FaucetCommandDto,
  FaucetCommandEventDto,
  FaucetCommandQueryInput,
  FaucetCommandStatus,
  FaucetCommandAction,
  PaginatedFaucetCommandsDto,
  UserRole,
  mapPhaseToVolume,
} from '@kebun-melon/contracts';
import crypto from 'crypto';

export class FaucetCommandNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaucetCommandNotFoundError';
  }
}

export class FaucetCommandConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaucetCommandConflictError';
  }
}

export class InvalidCommandStateTransitionError extends Error {
  constructor(fromStatus: FaucetCommandStatus, toStatus: FaucetCommandStatus) {
    super(`Invalid faucet command status transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = 'InvalidCommandStateTransitionError';
  }
}

export class DuplicateCommandEventError extends Error {
  constructor(messageId: string) {
    super(`Faucet command event with messageId '${messageId}' already exists.`);
    this.name = 'DuplicateCommandEventError';
  }
}

const FINAL_STATUSES: FaucetCommandStatus[] = [
  FaucetCommandStatus.COMPLETED,
  FaucetCommandStatus.FAILED,
  FaucetCommandStatus.CANCELLED,
  FaucetCommandStatus.TIMEOUT,
  FaucetCommandStatus.EXPIRED,
];

const ACTIVE_STATUSES: FaucetCommandStatus[] = [
  FaucetCommandStatus.QUEUED,
  FaucetCommandStatus.SENT,
  FaucetCommandStatus.ACKNOWLEDGED,
  FaucetCommandStatus.IN_PROGRESS,
];

const VALID_TRANSITIONS: Record<FaucetCommandStatus, FaucetCommandStatus[]> = {
  [FaucetCommandStatus.QUEUED]: [
    FaucetCommandStatus.SENT,
    FaucetCommandStatus.CANCELLED,
    FaucetCommandStatus.EXPIRED,
    FaucetCommandStatus.FAILED,
  ],
  [FaucetCommandStatus.SENT]: [
    FaucetCommandStatus.ACKNOWLEDGED,
    FaucetCommandStatus.FAILED,
    FaucetCommandStatus.TIMEOUT,
    FaucetCommandStatus.EXPIRED,
    FaucetCommandStatus.CANCELLED,
  ],
  [FaucetCommandStatus.ACKNOWLEDGED]: [
    FaucetCommandStatus.IN_PROGRESS,
    FaucetCommandStatus.FAILED,
    FaucetCommandStatus.TIMEOUT,
    FaucetCommandStatus.CANCELLED,
  ],
  [FaucetCommandStatus.IN_PROGRESS]: [
    FaucetCommandStatus.COMPLETED,
    FaucetCommandStatus.FAILED,
    FaucetCommandStatus.TIMEOUT,
    FaucetCommandStatus.CANCELLED,
  ],
  [FaucetCommandStatus.COMPLETED]: [],
  [FaucetCommandStatus.FAILED]: [],
  [FaucetCommandStatus.CANCELLED]: [],
  [FaucetCommandStatus.TIMEOUT]: [],
  [FaucetCommandStatus.EXPIRED]: [],
};

export class FaucetCommandRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private formatEventDto(event: any): FaucetCommandEventDto {
    return {
      id: event.id,
      faucetCommandId: event.faucetCommandId,
      eventStatus: event.eventStatus as FaucetCommandStatus,
      messageId: event.messageId || null,
      reasonCode: event.reasonCode || null,
      actualVolumeMl:
        event.actualVolumeMl !== null && event.actualVolumeMl !== undefined
          ? Number(event.actualVolumeMl)
          : null,
      recordedAt: event.recordedAt || null,
      receivedAt: event.receivedAt,
      metadata:
        event.metadata && typeof event.metadata === 'object'
          ? (event.metadata as Record<string, unknown>)
          : null,
      createdAt: event.createdAt,
    };
  }

  private formatCommandDto(command: any): FaucetCommandDto {
    return {
      id: command.id,
      commandId: command.commandId,
      deviceId: command.deviceId,
      initiatedByUserId: command.initiatedByUserId,
      initiatedByRole: command.initiatedByRole as UserRole,
      action: command.action as FaucetCommandAction,
      phase: command.phase !== null ? command.phase : null,
      plantCount: command.plantCount !== null ? command.plantCount : null,
      targetVolumeMl: command.targetVolumeMl !== null ? command.targetVolumeMl : null,
      actualVolumeMl:
        command.actualVolumeMl !== null && command.actualVolumeMl !== undefined
          ? Number(command.actualVolumeMl)
          : null,
      status: command.status as FaucetCommandStatus,
      requestedAt: command.requestedAt,
      queuedAt: command.queuedAt || null,
      sentAt: command.sentAt || null,
      acknowledgedAt: command.acknowledgedAt || null,
      startedAt: command.startedAt || null,
      completedAt: command.completedAt || null,
      failedAt: command.failedAt || null,
      cancelledAt: command.cancelledAt || null,
      expiresAt: command.expiresAt,
      failureReasonCode: command.failureReasonCode || null,
      idempotencyKey: command.idempotencyKey,
      createdAt: command.createdAt,
      updatedAt: command.updatedAt,
      events: Array.isArray(command.events)
        ? command.events.map((e: any) => this.formatEventDto(e))
        : undefined,
    };
  }

  /**
   * Creates a new durable FaucetCommand record and initial FaucetCommandEvent.
   * Enforces server-side phase-volume mapping and idempotency checks.
   */
  async createCommand(
    input: CreateFaucetCommandInput,
    actorUserId: string,
    actorRole: UserRole
  ): Promise<FaucetCommandDto> {
    const isDispense = input.action === FaucetCommandAction.DISPENSE;
    const targetVolumeMl =
      isDispense && input.phase !== undefined && input.plantCount !== undefined
        ? mapPhaseToVolume(input.phase) * input.plantCount
        : null;

    const now = input.requestedAt ? new Date(input.requestedAt) : new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(now.getTime() + 5 * 60 * 1000);
    const commandId = `cmd-${crypto.randomUUID()}`;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // 1. Idempotency check inside transaction
        const existingKey = await tx.faucetCommand.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { events: { orderBy: { receivedAt: 'asc' } } },
        });

        if (existingKey) {
          if (
            existingKey.deviceId === input.deviceId &&
            existingKey.action === input.action &&
            existingKey.phase === (input.phase ?? null) &&
            existingKey.plantCount === (input.plantCount ?? null)
          ) {
            return existingKey;
          }
          throw new FaucetCommandConflictError(
            `Idempotency key '${input.idempotencyKey}' has already been used for a different command.`
          );
        }

        // 2. Active command concurrency check (max 1 active per device)
        const activeCommand = await tx.faucetCommand.findFirst({
          where: {
            deviceId: input.deviceId,
            status: { in: ACTIVE_STATUSES },
          },
        });

        if (activeCommand) {
          throw new FaucetCommandConflictError(
            `Device '${input.deviceId}' already has an active faucet command in progress (commandId: ${activeCommand.commandId}, status: ${activeCommand.status}).`
          );
        }

        const cmd = await tx.faucetCommand.create({
          data: {
            commandId,
            deviceId: input.deviceId,
            initiatedByUserId: actorUserId,
            initiatedByRole: actorRole,
            action: input.action,
            phase: isDispense ? input.phase : null,
            plantCount: isDispense ? input.plantCount : null,
            targetVolumeMl,
            status: FaucetCommandStatus.QUEUED,
            requestedAt: now,
            queuedAt: now,
            expiresAt,
            idempotencyKey: input.idempotencyKey,
          },
        });

        const evt = await tx.faucetCommandEvent.create({
          data: {
            faucetCommandId: cmd.id,
            eventStatus: FaucetCommandStatus.QUEUED,
            receivedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            eventKey: 'faucet.command.created',
            actorUserId,
            actorRole,
            targetType: 'faucet_command',
            targetId: cmd.id,
            result: 'SUCCESS',
            newValues: {
              commandId: cmd.commandId,
              deviceId: cmd.deviceId,
              action: cmd.action,
              phase: cmd.phase,
              plantCount: cmd.plantCount,
              targetVolumeMl: cmd.targetVolumeMl,
              idempotencyKey: cmd.idempotencyKey,
              status: cmd.status,
            },
          },
        });

        return { ...cmd, events: [evt] };
      });

      return this.formatCommandDto(created);
    } catch (error: any) {
      if (error instanceof FaucetCommandConflictError) {
        throw error;
      }

      if (
        (error instanceof Prisma.PrismaClientKnownRequestError || error?.code === 'P2002') &&
        error.code === 'P2002'
      ) {
        const existingKey = await this.prisma.faucetCommand.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { events: { orderBy: { receivedAt: 'asc' } } },
        });

        if (existingKey) {
          if (
            existingKey.deviceId === input.deviceId &&
            existingKey.action === input.action &&
            existingKey.phase === (input.phase ?? null) &&
            existingKey.plantCount === (input.plantCount ?? null)
          ) {
            return this.formatCommandDto(existingKey);
          }
          throw new FaucetCommandConflictError(
            `Idempotency key '${input.idempotencyKey}' has already been used for a different command.`
          );
        }

        throw new FaucetCommandConflictError(
          `Faucet command creation failed due to unique constraint conflict.`
        );
      }
      throw error;
    }
  }

  /**
   * Fetches single command by DB UUID or commandId.
   */
  async getCommandById(idOrCommandId: string): Promise<FaucetCommandDto | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCommandId
    );

    const command = await this.prisma.faucetCommand.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrCommandId }, { commandId: idOrCommandId }] }
        : { commandId: idOrCommandId },
      include: { events: { orderBy: { receivedAt: 'asc' } } },
    });

    return command ? this.formatCommandDto(command) : null;
  }

  /**
   * Fetches single command by idempotencyKey.
   */
  async getCommandByIdempotencyKey(key: string): Promise<FaucetCommandDto | null> {
    const command = await this.prisma.faucetCommand.findUnique({
      where: { idempotencyKey: key },
      include: { events: { orderBy: { receivedAt: 'asc' } } },
    });

    return command ? this.formatCommandDto(command) : null;
  }

  /**
   * Fetches paginated faucet commands.
   */
  async getCommands(
    query: FaucetCommandQueryInput,
    authorizedDeviceIds?: string[]
  ): Promise<PaginatedFaucetCommandsDto> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.FaucetCommandWhereInput = {};

    if (authorizedDeviceIds !== undefined) {
      if (query.deviceId) {
        if (authorizedDeviceIds.includes(query.deviceId)) {
          where.deviceId = query.deviceId;
        } else {
          return {
            items: [],
            pagination: { page, pageSize, totalItems: 0, totalPages: 1 },
          };
        }
      } else {
        where.deviceId = { in: authorizedDeviceIds };
      }
    } else if (query.deviceId) {
      where.deviceId = query.deviceId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.initiatedByUserId) {
      where.initiatedByUserId = query.initiatedByUserId;
    }

    if (query.from || query.to) {
      where.requestedAt = {};
      if (query.from) where.requestedAt.gte = new Date(query.from);
      if (query.to) where.requestedAt.lte = new Date(query.to);
    }

    const [rawSortField, rawSortOrder] = (query.sort || 'requestedAt:desc').split(':');
    const sortField = ['requestedAt', 'createdAt', 'status'].includes(rawSortField)
      ? rawSortField
      : 'requestedAt';
    const sortOrder: Prisma.SortOrder = rawSortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [totalItems, rawCommands] = await Promise.all([
      this.prisma.faucetCommand.count({ where }),
      this.prisma.faucetCommand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortOrder },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const items = rawCommands.map((c) => this.formatCommandDto(c));

    return {
      items,
      pagination: { page, pageSize, totalItems, totalPages },
    };
  }

  /**
   * Transactionally updates command status and records lifecycle event.
   * Prevents invalid state transitions and state regressions.
   */
  async updateCommandStatus(
    idOrCommandId: string,
    targetStatus: FaucetCommandStatus,
    eventData?: {
      messageId?: string;
      reasonCode?: string;
      actualVolumeMl?: number;
      recordedAt?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<FaucetCommandDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCommandId
    );
    const existing = await this.prisma.faucetCommand.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrCommandId }, { commandId: idOrCommandId }] }
        : { commandId: idOrCommandId },
    });

    if (!existing) {
      throw new FaucetCommandNotFoundError(`Faucet command '${idOrCommandId}' was not found.`);
    }

    const currentStatus = existing.status as FaucetCommandStatus;

    // Idempotent update: already in target status
    if (currentStatus === targetStatus) {
      const fullCommand = await this.prisma.faucetCommand.findUnique({
        where: { id: existing.id },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      });
      return this.formatCommandDto(fullCommand!);
    }

    // Disallow transitions from final states
    if (FINAL_STATUSES.includes(currentStatus)) {
      throw new InvalidCommandStateTransitionError(currentStatus, targetStatus);
    }

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new InvalidCommandStateTransitionError(currentStatus, targetStatus);
    }

    const now = new Date();
    const updateData: Prisma.FaucetCommandUpdateInput = {
      status: targetStatus,
    };

    if (targetStatus === FaucetCommandStatus.SENT) updateData.sentAt = now;
    else if (targetStatus === FaucetCommandStatus.ACKNOWLEDGED) updateData.acknowledgedAt = now;
    else if (targetStatus === FaucetCommandStatus.IN_PROGRESS) updateData.startedAt = now;
    else if (targetStatus === FaucetCommandStatus.COMPLETED) {
      updateData.completedAt = now;
      if (eventData?.actualVolumeMl !== undefined) {
        updateData.actualVolumeMl = eventData.actualVolumeMl;
      }
    } else if (targetStatus === FaucetCommandStatus.FAILED) {
      updateData.failedAt = now;
      if (eventData?.reasonCode) updateData.failureReasonCode = eventData.reasonCode;
    } else if (targetStatus === FaucetCommandStatus.CANCELLED) {
      updateData.cancelledAt = now;
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.faucetCommand.update({
        where: { id: existing.id },
        data: updateData,
      });

      await tx.faucetCommandEvent.create({
        data: {
          faucetCommandId: existing.id,
          eventStatus: targetStatus,
          messageId: eventData?.messageId || null,
          reasonCode: eventData?.reasonCode || null,
          actualVolumeMl: eventData?.actualVolumeMl !== undefined ? eventData.actualVolumeMl : null,
          recordedAt: eventData?.recordedAt || null,
          receivedAt: now,
          metadata: eventData?.metadata
            ? (eventData.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      const updated = await tx.faucetCommand.findUnique({
        where: { id: existing.id },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      });

      return this.formatCommandDto(updated!);
    });
  }

  /**
   * Appends a new event to the append-only faucet command event store.
   */
  async addCommandEvent(
    idOrCommandId: string,
    eventData: {
      eventStatus: FaucetCommandStatus;
      messageId?: string;
      reasonCode?: string;
      actualVolumeMl?: number;
      recordedAt?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<FaucetCommandEventDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCommandId
    );
    const existingCmd = await this.prisma.faucetCommand.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrCommandId }, { commandId: idOrCommandId }] }
        : { commandId: idOrCommandId },
    });

    if (!existingCmd) {
      throw new FaucetCommandNotFoundError(`Faucet command '${idOrCommandId}' was not found.`);
    }

    if (eventData.messageId) {
      const existingEvt = await this.prisma.faucetCommandEvent.findFirst({
        where: { messageId: eventData.messageId },
      });

      if (existingEvt) {
        return this.formatEventDto(existingEvt);
      }
    }

    try {
      const created = await this.prisma.faucetCommandEvent.create({
        data: {
          faucetCommandId: existingCmd.id,
          eventStatus: eventData.eventStatus,
          messageId: eventData.messageId || null,
          reasonCode: eventData.reasonCode || null,
          actualVolumeMl: eventData.actualVolumeMl !== undefined ? eventData.actualVolumeMl : null,
          recordedAt: eventData.recordedAt || null,
          receivedAt: new Date(),
          metadata: eventData.metadata
            ? (eventData.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      return this.formatEventDto(created);
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        eventData.messageId
      ) {
        const existingEvt = await this.prisma.faucetCommandEvent.findFirst({
          where: { messageId: eventData.messageId },
        });
        if (existingEvt) return this.formatEventDto(existingEvt);
      }
      throw error;
    }
  }
}
