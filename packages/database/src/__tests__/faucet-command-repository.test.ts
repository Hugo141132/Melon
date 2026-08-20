import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FaucetCommandRepository,
  FaucetCommandConflictError,
  FaucetCommandNotFoundError,
  InvalidCommandStateTransitionError,
} from '../faucet-command-repository';
import { FaucetCommandStatus, UserRole, FaucetCommandAction } from '@kebun-melon/contracts';

describe('FaucetCommandRepository Unit & Integration Tests', () => {
  let mockPrisma: any;
  let repository: FaucetCommandRepository;

  beforeEach(() => {
    mockPrisma = {
      faucetCommand: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      faucetCommandEvent: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    repository = new FaucetCommandRepository(mockPrisma as any);
  });

  const mockDeviceId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  const mockCommandRecord = {
    id: '33333333-3333-3333-3333-333333333333',
    commandId: 'cmd-test-001',
    deviceId: mockDeviceId,
    initiatedByUserId: mockUserId,
    initiatedByRole: UserRole.ADMIN,
    action: 'DISPENSE',
    phase: 1,
    plantCount: 1,
    targetVolumeMl: 300,
    actualVolumeMl: null,
    status: 'QUEUED',
    requestedAt: new Date('2026-08-02T10:00:00Z'),
    queuedAt: new Date('2026-08-02T10:00:00Z'),
    sentAt: null,
    acknowledgedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: new Date('2026-08-02T10:05:00Z'),
    failureReasonCode: null,
    idempotencyKey: 'idem-001',
    createdAt: new Date('2026-08-02T10:00:00Z'),
    updatedAt: new Date('2026-08-02T10:00:00Z'),
    events: [
      {
        id: 'evt-001',
        faucetCommandId: '33333333-3333-3333-3333-333333333333',
        eventStatus: 'QUEUED',
        messageId: null,
        reasonCode: null,
        actualVolumeMl: null,
        recordedAt: null,
        receivedAt: new Date('2026-08-02T10:00:00Z'),
        metadata: null,
        createdAt: new Date('2026-08-02T10:00:00Z'),
      },
    ],
  };

  // TASK-0808: Mock records for OPEN and CLOSE actions
  const mockOpenCommandRecord = {
    ...mockCommandRecord,
    id: '44444444-4444-4444-4444-444444444444',
    commandId: 'cmd-test-open-001',
    action: 'OPEN',
    phase: null,
    plantCount: null,
    targetVolumeMl: null,
    idempotencyKey: 'idem-open-001',
  };

  const mockCloseCommandRecord = {
    ...mockCommandRecord,
    id: '55555555-5555-5555-5555-555555555555',
    commandId: 'cmd-test-close-001',
    action: 'CLOSE',
    phase: null,
    plantCount: null,
    targetVolumeMl: null,
    idempotencyKey: 'idem-close-001',
  };

  describe('createCommand', () => {
    it('creates a command with phase 1 (300 mL) and records QUEUED event in a transaction', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(null);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      mockPrisma.faucetCommand.create.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommandEvent.create.mockResolvedValue(mockCommandRecord.events[0]);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.DISPENSE,
          phase: 1,
          plantCount: 1,
          idempotencyKey: 'idem-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(mockPrisma.faucetCommand.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'idem-001' },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      });
      expect(result.phase).toBe(1);
      expect(result.targetVolumeMl).toBe(300);
      expect(result.status).toBe(FaucetCommandStatus.QUEUED);
      expect(result.events?.length).toBe(1);
    });

    it('returns existing command when exact same idempotencyKey, deviceId, and phase are submitted', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.DISPENSE,
          phase: 1,
          plantCount: 1,
          idempotencyKey: 'idem-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockCommandRecord.commandId);
      expect(mockPrisma.faucetCommand.create).not.toHaveBeenCalled();
    });

    it('returns existing command when a concurrent request throws P2002 but key matches identical parameters', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      const p2002Error = new (class extends Error {
        code = 'P2002';
      })('Unique constraint failed');
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.DISPENSE,
          phase: 1,
          plantCount: 1,
          idempotencyKey: 'idem-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockCommandRecord.commandId);
    });

    it('throws FaucetCommandConflictError when a concurrent request throws P2002 and key matches a conflicting phase', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      const p2002Error = new (class extends Error {
        code = 'P2002';
      })('Unique constraint failed');
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            action: FaucetCommandAction.DISPENSE,
            phase: 2, // Conflicting phase
            plantCount: 1,
            idempotencyKey: 'idem-001',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
    });

    it('throws FaucetCommandConflictError when idempotencyKey is reused for a different device or phase', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            action: FaucetCommandAction.DISPENSE,
            phase: 2, // Different phase
            plantCount: 1,
            idempotencyKey: 'idem-001',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
    });

    it('throws FaucetCommandConflictError when target device already has an active command', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(null);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            action: FaucetCommandAction.DISPENSE,
            phase: 2,
            plantCount: 1,
            idempotencyKey: 'idem-new-key',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
    });

    // TASK-0808: Revalidation for DISPENSE with plantCount multiplier
    it('throws FaucetCommandConflictError when DISPENSE idempotencyKey is reused with a different plantCount', async () => {
      // Existing command has plantCount=1; replay with plantCount=2 must conflict
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord); // plantCount: 1

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            action: FaucetCommandAction.DISPENSE,
            phase: 1,
            plantCount: 2, // Different plantCount
            idempotencyKey: 'idem-001',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
    });

    it('returns existing DISPENSE command when idempotencyKey and identical plantCount are re-submitted (network retry)', async () => {
      // Simulates a network retry where the client resends the exact same DISPENSE request
      const multiPlantRecord = { ...mockCommandRecord, plantCount: 3, targetVolumeMl: 900 };
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(multiPlantRecord); // plantCount: 3

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.DISPENSE,
          phase: 1,
          plantCount: 3, // Same plantCount
          idempotencyKey: 'idem-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(multiPlantRecord.commandId);
      expect(result.plantCount).toBe(3);
      expect(mockPrisma.faucetCommand.create).not.toHaveBeenCalled();
    });

    // TASK-0808: Revalidation for OPEN action idempotency
    it('returns existing OPEN command when idempotencyKey and identical OPEN action are re-submitted', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockOpenCommandRecord);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.OPEN,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-open-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockOpenCommandRecord.commandId);
      expect(result.action).toBe(FaucetCommandAction.OPEN);
      expect(result.phase).toBeNull();
      expect(result.plantCount).toBeNull();
      expect(result.targetVolumeMl).toBeNull();
      expect(mockPrisma.faucetCommand.create).not.toHaveBeenCalled();
    });

    it('throws FaucetCommandConflictError when OPEN idempotencyKey is reused for a different action (CLOSE)', async () => {
      // OPEN command stored; client sends CLOSE with same key → conflict
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockOpenCommandRecord);

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            action: FaucetCommandAction.CLOSE, // Different action
            phase: undefined,
            plantCount: undefined,
            idempotencyKey: 'idem-open-001',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
    });

    // TASK-0808: Revalidation for CLOSE action idempotency
    it('returns existing CLOSE command when idempotencyKey and identical CLOSE action are re-submitted', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCloseCommandRecord);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.CLOSE,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-close-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockCloseCommandRecord.commandId);
      expect(result.action).toBe(FaucetCommandAction.CLOSE);
      expect(result.phase).toBeNull();
      expect(result.plantCount).toBeNull();
      expect(result.targetVolumeMl).toBeNull();
      expect(mockPrisma.faucetCommand.create).not.toHaveBeenCalled();
    });

    // TASK-0808: P2002 network retry path for OPEN action
    it('returns existing OPEN command when concurrent P2002 collision resolves to identical OPEN parameters', async () => {
      // Simulate race: $transaction fails with P2002, outer re-fetch finds the OPEN record
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockOpenCommandRecord);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      const p2002Error = new (class extends Error {
        code = 'P2002';
      })('Unique constraint failed');
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.OPEN,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-open-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockOpenCommandRecord.commandId);
      expect(result.action).toBe(FaucetCommandAction.OPEN);
    });

    // TASK-0808: P2002 network retry path for CLOSE action
    it('returns existing CLOSE command when concurrent P2002 collision resolves to identical CLOSE parameters', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCloseCommandRecord);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      const p2002Error = new (class extends Error {
        code = 'P2002';
      })('Unique constraint failed');
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.CLOSE,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-close-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockCloseCommandRecord.commandId);
      expect(result.action).toBe(FaucetCommandAction.CLOSE);
    });

    it('creates AuditLog with faucet.command.open.created when new OPEN command is created', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(null);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      mockPrisma.faucetCommand.create.mockResolvedValue(mockOpenCommandRecord);
      mockPrisma.faucetCommandEvent.create.mockResolvedValue(mockOpenCommandRecord.events[0]);

      await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.OPEN,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-new-open-001',
        },
        mockUserId,
        UserRole.OWNER
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: 'faucet.command.open.created',
          actorUserId: mockUserId,
          actorRole: UserRole.OWNER,
          targetType: 'faucet_command',
          targetId: mockOpenCommandRecord.id,
          result: 'SUCCESS',
        }),
      });
    });

    it('creates AuditLog with faucet.command.close.created when new CLOSE command is created', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(null);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      mockPrisma.faucetCommand.create.mockResolvedValue(mockCloseCommandRecord);
      mockPrisma.faucetCommandEvent.create.mockResolvedValue(mockCloseCommandRecord.events[0]);

      await repository.createCommand(
        {
          deviceId: mockDeviceId,
          action: FaucetCommandAction.CLOSE,
          phase: undefined,
          plantCount: undefined,
          idempotencyKey: 'idem-new-close-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: 'faucet.command.close.created',
          actorUserId: mockUserId,
          actorRole: UserRole.ADMIN,
          targetType: 'faucet_command',
          targetId: mockCloseCommandRecord.id,
          result: 'SUCCESS',
        }),
      });
    });
  });

  describe('updateCommandStatus', () => {
    it('successfully updates command status from QUEUED to SENT', async () => {
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);
      const sentRecord = { ...mockCommandRecord, status: 'SENT', sentAt: new Date() };
      mockPrisma.faucetCommand.update.mockResolvedValue(sentRecord);
      mockPrisma.faucetCommandEvent.create.mockResolvedValue({
        id: 'evt-002',
        faucetCommandId: mockCommandRecord.id,
        eventStatus: 'SENT',
        receivedAt: new Date(),
      });
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(sentRecord);

      const result = await repository.updateCommandStatus(
        mockCommandRecord.id,
        FaucetCommandStatus.SENT
      );

      expect(result.status).toBe(FaucetCommandStatus.SENT);
      expect(mockPrisma.faucetCommand.update).toHaveBeenCalledWith({
        where: { id: mockCommandRecord.id },
        data: expect.objectContaining({ status: FaucetCommandStatus.SENT }),
      });
    });

    it('is idempotent when updateCommandStatus is called with current status', async () => {
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);

      const result = await repository.updateCommandStatus(
        mockCommandRecord.id,
        FaucetCommandStatus.QUEUED
      );

      expect(result.status).toBe(FaucetCommandStatus.QUEUED);
      expect(mockPrisma.faucetCommand.update).not.toHaveBeenCalled();
    });

    it('throws InvalidCommandStateTransitionError when attempting invalid status jump (e.g. QUEUED to COMPLETED)', async () => {
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);

      await expect(
        repository.updateCommandStatus(mockCommandRecord.id, FaucetCommandStatus.COMPLETED)
      ).rejects.toThrow(InvalidCommandStateTransitionError);
    });

    it('throws InvalidCommandStateTransitionError when attempting status regression from final status', async () => {
      const completedRecord = { ...mockCommandRecord, status: 'COMPLETED' };
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(completedRecord);

      await expect(
        repository.updateCommandStatus(mockCommandRecord.id, FaucetCommandStatus.QUEUED)
      ).rejects.toThrow(InvalidCommandStateTransitionError);
    });

    it('throws FaucetCommandNotFoundError when command does not exist', async () => {
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);

      await expect(
        repository.updateCommandStatus('nonexistent-id', FaucetCommandStatus.SENT)
      ).rejects.toThrow(FaucetCommandNotFoundError);
    });
  });

  describe('addCommandEvent', () => {
    it('appends an event and returns existing event if messageId is duplicated', async () => {
      const mockEvent = {
        id: 'evt-003',
        faucetCommandId: mockCommandRecord.id,
        eventStatus: 'SENT',
        messageId: 'msg-001',
        receivedAt: new Date(),
      };

      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommandEvent.findFirst.mockResolvedValue(mockEvent);

      const result = await repository.addCommandEvent(mockCommandRecord.id, {
        eventStatus: FaucetCommandStatus.SENT,
        messageId: 'msg-001',
      });

      expect(result.id).toBe('evt-003');
      expect(mockPrisma.faucetCommandEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('getCommandById', () => {
    it('queries only commandId when input is a non-UUID string (e.g. cmd-test-001)', async () => {
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);

      const result = await repository.getCommandById('cmd-test-001');

      expect(mockPrisma.faucetCommand.findFirst).toHaveBeenCalledWith({
        where: { commandId: 'cmd-test-001' },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      });
      expect(result?.commandId).toBe('cmd-test-001');
    });

    it('queries both id and commandId via OR when input is a valid UUID', async () => {
      const validUuid = '33333333-3333-3333-3333-333333333333';
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(mockCommandRecord);

      const result = await repository.getCommandById(validUuid);

      expect(mockPrisma.faucetCommand.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: validUuid }, { commandId: validUuid }] },
        include: { events: { orderBy: { receivedAt: 'asc' } } },
      });
      expect(result?.id).toBe(validUuid);
    });
  });
});
