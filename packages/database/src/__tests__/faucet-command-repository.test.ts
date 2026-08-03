import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FaucetCommandRepository,
  FaucetCommandConflictError,
  FaucetCommandNotFoundError,
  InvalidCommandStateTransitionError,
} from '../faucet-command-repository';
import { FaucetCommandStatus, UserRole } from '@kebun-melon/contracts';

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
    phase: 1,
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

  describe('createCommand', () => {
    it('creates a command with phase 1 (300 mL) and records QUEUED event in a transaction', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(null);
      mockPrisma.faucetCommand.findFirst.mockResolvedValue(null);
      mockPrisma.faucetCommand.create.mockResolvedValue(mockCommandRecord);
      mockPrisma.faucetCommandEvent.create.mockResolvedValue(mockCommandRecord.events[0]);

      const result = await repository.createCommand(
        {
          deviceId: mockDeviceId,
          phase: 1,
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
          phase: 1,
          idempotencyKey: 'idem-001',
        },
        mockUserId,
        UserRole.ADMIN
      );

      expect(result.commandId).toBe(mockCommandRecord.commandId);
      expect(mockPrisma.faucetCommand.create).not.toHaveBeenCalled();
    });

    it('throws FaucetCommandConflictError when idempotencyKey is reused for a different device or phase', async () => {
      mockPrisma.faucetCommand.findUnique.mockResolvedValue(mockCommandRecord);

      await expect(
        repository.createCommand(
          {
            deviceId: mockDeviceId,
            phase: 2, // Different phase
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
            phase: 2,
            idempotencyKey: 'idem-new-key',
          },
          mockUserId,
          UserRole.ADMIN
        )
      ).rejects.toThrow(FaucetCommandConflictError);
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
