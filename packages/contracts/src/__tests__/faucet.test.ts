import { describe, it, expect } from 'vitest';
import {
  mapPhaseToVolume,
  InvalidFaucetPhaseError,
  CreateFaucetCommandInputSchema,
  FaucetCommandDtoSchema,
  FaucetCommandStatus,
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

  it('throws InvalidFaucetPhaseError for unsupported phases', () => {
    expect(() => mapPhaseToVolume(0)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(4)).toThrow(InvalidFaucetPhaseError);
    expect(() => mapPhaseToVolume(-1)).toThrow("Invalid faucet phase '-1'");
  });

  it('validates CreateFaucetCommandInputSchema correctly', () => {
    const validPayload = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      phase: 2,
      idempotencyKey: 'idem-key-001',
    };

    const parsed = CreateFaucetCommandInputSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);

    const invalidPayload = {
      deviceId: 'not-a-uuid',
      phase: 5,
      idempotencyKey: '',
    };

    const invalidParsed = CreateFaucetCommandInputSchema.safeParse(invalidPayload);
    expect(invalidParsed.success).toBe(false);
  });

  it('validates FaucetCommandDtoSchema correctly', () => {
    const validDto = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      commandId: 'cmd-001',
      deviceId: '123e4567-e89b-12d3-a456-426614174001',
      initiatedByUserId: '123e4567-e89b-12d3-a456-426614174002',
      initiatedByRole: UserRole.ADMIN,
      phase: 1,
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
  });
});
