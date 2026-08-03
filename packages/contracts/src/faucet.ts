import { z } from 'zod';
import { FaucetCommandStatus, UserRole } from './enums';

/**
 * Approved Faucet Preset Target Volumes (mL)
 * Phase 1 -> 300 mL
 * Phase 2 -> 1,000 mL
 * Phase 3 -> 1,500 mL
 */
export const FAUCET_PRESET_VOLUMES: Record<number, number> = {
  1: 300,
  2: 1000,
  3: 1500,
};

export class InvalidFaucetPhaseError extends Error {
  constructor(phase: number) {
    super(
      `Invalid faucet phase '${phase}'. Allowed phases are 1 (300 mL), 2 (1000 mL), and 3 (1500 mL).`
    );
    this.name = 'InvalidFaucetPhaseError';
  }
}

/**
 * Server-side deterministic mapping of phase to target volume in mL.
 */
export function mapPhaseToVolume(phase: number): number {
  const volume = FAUCET_PRESET_VOLUMES[phase];
  if (volume === undefined) {
    throw new InvalidFaucetPhaseError(phase);
  }
  return volume;
}

export const CreateFaucetCommandInputSchema = z.object({
  deviceId: z.string().uuid(),
  phase: z.number().int().min(1).max(3),
  idempotencyKey: z.string().trim().min(1).max(150),
  requestedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateFaucetCommandInput = z.infer<typeof CreateFaucetCommandInputSchema>;

export const FaucetCommandEventDtoSchema = z.object({
  id: z.string().uuid(),
  faucetCommandId: z.string().uuid(),
  eventStatus: z.nativeEnum(FaucetCommandStatus),
  messageId: z.string().nullable(),
  reasonCode: z.string().nullable(),
  actualVolumeMl: z.number().nullable(),
  recordedAt: z.date().nullable(),
  receivedAt: z.date(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
});

export type FaucetCommandEventDto = z.infer<typeof FaucetCommandEventDtoSchema>;

export const FaucetCommandDtoSchema = z.object({
  id: z.string().uuid(),
  commandId: z.string(),
  deviceId: z.string().uuid(),
  initiatedByUserId: z.string().uuid(),
  initiatedByRole: z.nativeEnum(UserRole),
  phase: z.number().int(),
  targetVolumeMl: z.number().int(),
  actualVolumeMl: z.number().nullable(),
  status: z.nativeEnum(FaucetCommandStatus),
  requestedAt: z.date(),
  queuedAt: z.date().nullable(),
  sentAt: z.date().nullable(),
  acknowledgedAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  expiresAt: z.date(),
  failureReasonCode: z.string().nullable(),
  idempotencyKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  events: z.array(FaucetCommandEventDtoSchema).optional(),
});

export type FaucetCommandDto = z.infer<typeof FaucetCommandDtoSchema>;

export const FaucetCommandQueryInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  deviceId: z.string().uuid().optional(),
  status: z.nativeEnum(FaucetCommandStatus).optional(),
  initiatedByUserId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.string().default('requestedAt:desc'),
});

export type FaucetCommandQueryInput = z.infer<typeof FaucetCommandQueryInputSchema>;

export const PaginatedFaucetCommandsDtoSchema = z.object({
  items: z.array(FaucetCommandDtoSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type PaginatedFaucetCommandsDto = z.infer<typeof PaginatedFaucetCommandsDtoSchema>;

/**
 * Canonical Faucet Acknowledgement Rejection Reason Codes
 */
export const FAUCET_ACK_REASON_CODES = [
  'INVALID_COMMAND',
  'INVALID_PHASE',
  'EXPIRED_COMMAND',
  'DUPLICATE_COMMAND',
  'DEVICE_BUSY',
  'DEVICE_NOT_READY',
  'INSUFFICIENT_WATER',
  'CONTROL_DISABLED',
  'UNSUPPORTED_ACTION',
  'INTERNAL_ERROR',
  'REJECTED_BY_DEVICE',
] as const;

export type FaucetAckReasonCode = (typeof FAUCET_ACK_REASON_CODES)[number];

/**
 * Faucet Acknowledgement MQTT Payload Schema
 * Topic: agriculture/{environment}/{siteId}/{deviceId}/ack/faucet
 */
export const FaucetAcknowledgementPayloadSchema = z.object({
  schemaVersion: z.string().default('1.0'),
  messageId: z.string().trim().min(1),
  commandId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  recordedAt: z.string().optional(),
  data: z.object({
    status: z.enum(['ACKNOWLEDGED', 'REJECTED']),
    accepted: z.boolean(),
    reasonCode: z.string().trim().optional(),
  }),
});

export type FaucetAcknowledgementPayload = z.infer<typeof FaucetAcknowledgementPayloadSchema>;

/**
 * Faucet Progress/Execution Event MQTT Payload Schema
 * Topic: agriculture/{environment}/{siteId}/{deviceId}/event/faucet
 */
export const FaucetEventPayloadSchema = z.object({
  schemaVersion: z.string().default('1.0'),
  messageId: z.string().trim().min(1),
  commandId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  recordedAt: z.string().optional(),
  data: z.object({
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'FAILED']),
    targetVolumeMl: z.number().int().positive().optional(),
    actualVolumeMl: z.number().min(0).optional(),
    reasonCode: z.string().trim().optional(),
  }),
});

export type FaucetEventPayload = z.infer<typeof FaucetEventPayloadSchema>;
