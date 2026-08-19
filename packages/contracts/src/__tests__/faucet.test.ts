import { describe, it, expect } from 'vitest';
import {
  mapPhaseToVolume,
  InvalidFaucetPhaseError,
  CreateFaucetCommandInputSchema,
  FaucetCommandDtoSchema,
  FaucetCommandStatus,
  FaucetCommandAction,
  UserRole,
} from '../index';

describe('Faucet Contracts & Phase-Volume Mapping', () => {
  it('correctly maps Phase 1 to 300 mL', () => {
    expect(mapPhaseToVolume(1)).toBe(300);
  });

  it('correctly maps Phase 2 to 1000 mL', () => {
    expect(mapPhaseToVolume(2)).toBe(1000);
  });

  it('correctly maps Phase 3 to 1500 mL', () => {
    expect(mapPhaseToVolume(3)).toBe(1500);
  });

  it('throws InvalidFaucetPhaseError for unsupported phases, non-integers, and non-finite numbers', () => {
    expect(() => mapPhaseToVolume(0)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(4)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(-1)).toThrow("Invalid faucet phase '-1'");
    expect(() => mapPhaseToVolume(1.5)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(2.9)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(NaN)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(Infinity)).toThrow(InvalidFaucetPhaseError);
  });

  it('validates CreateFaucetCommandInputSchema and idempotencyKey constraints', () => {
    const validPayload = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      action: FaucetCommandAction.DISPENSE,
      phase: 2,
      plantCount: 3,
      idempotencyKey: 'idem-key-001',
      requestedAt: '2026-08-01T10:00:00.000Z',
      expiresAt: '2026-08-01T10:05:00.000Z',
    };

    const parsed = CreateFaucetCommandInputSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);

    // Empty or whitespace-only idempotency key must fail
    expect(
      CreateFaucetCommandInputSchema.safeParse({
        ...validPayload,
        idempotencyKey: '   ',
      }).success
    ).toBe(false);

    // Oversized idempotency key (> 150 chars) must fail
    expect(
      CreateFaucetCommandInputSchema.safeParse({
        ...validPayload,
        idempotencyKey: 'a'.repeat(151),
      }).success
    ).toBe(false);

    // Invalid device UUID must fail
    const invalidPayload = {
      deviceId: 'not-a-uuid',
      phase: 5,
      idempotencyKey: '',
    };

    const invalidParsed = CreateFaucetCommandInputSchema.safeParse(invalidPayload);
    expect(invalidParsed.success).toBe(false);

    // OPEN with phase should fail
    const openPayload = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      action: FaucetCommandAction.OPEN,
      phase: 2,
      idempotencyKey: 'idem-key-open',
    };
    expect(CreateFaucetCommandInputSchema.safeParse(openPayload).success).toBe(false);

    // OPEN without phase should pass
    const openValid = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      action: FaucetCommandAction.OPEN,
      idempotencyKey: 'idem-key-open',
    };
    expect(CreateFaucetCommandInputSchema.safeParse(openValid).success).toBe(true);
  });

  it('validates FaucetCommandDtoSchema correctly and verifies all canonical statuses', () => {
    const validDto = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      commandId: 'cmd-001',
      deviceId: '123e4567-e89b-12d3-a456-426614174001',
      initiatedByUserId: '123e4567-e89b-12d3-a456-426614174002',
      initiatedByRole: UserRole.ADMIN,
      action: FaucetCommandAction.DISPENSE,
      phase: 1,
      plantCount: 1,
      targetVolumeMl: 300,
      actualVolumeMl: null,
      status: FaucetCommandStatus.QUEUED,
      requestedAt: new Date(),
      queuedAt: new Date(),
      sentAt: null,
      acknowledgedAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 300000),
      failureReasonCode: null,
      idempotencyKey: 'idem-key-001',
      createdAt: new Date(),
      updatedAt: new Date(),
      events: [],
    };

    const parsed = FaucetCommandDtoSchema.safeParse(validDto);
    expect(parsed.success).toBe(true);

    const statuses = [
      FaucetCommandStatus.QUEUED,
      FaucetCommandStatus.SENT,
      FaucetCommandStatus.ACKNOWLEDGED,
      FaucetCommandStatus.IN_PROGRESS,
      FaucetCommandStatus.COMPLETED,
      FaucetCommandStatus.FAILED,
      FaucetCommandStatus.CANCELLED,
      FaucetCommandStatus.TIMEOUT,
      FaucetCommandStatus.EXPIRED,
    ];
    expect(statuses).toHaveLength(9);
  });
});
