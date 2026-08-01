import { z } from 'zod';
import { MonitoringStatus, TelemetryValidationStatus } from './enums';

/**
 * Shared Soil Telemetry Data Schema & Type
 * Source of truth: docs/DEVICE_COMMUNICATION.md §13, docs/DATABASE.md §8.2
 */
export const SoilTelemetryDataSchema = z.object({
  nitrogen: z.number().finite().nullable().optional().default(null),
  phosphorus: z.number().finite().nullable().optional().default(null),
  potassium: z.number().finite().nullable().optional().default(null),
  temperature: z.number().finite().nullable().optional().default(null),
  moisture: z.number().finite().nullable().optional().default(null),
  ph: z.number().finite().nullable().optional().default(null),
  ec: z.number().finite().nullable().optional().default(null),
  status: z.nativeEnum(MonitoringStatus).nullable().optional().default(null),
});

export type SoilTelemetryData = z.infer<typeof SoilTelemetryDataSchema>;

/**
 * Soil Telemetry Payload Envelope Schema & Type
 */
export const SoilTelemetryPayloadSchema = z.object({
  schemaVersion: z.string().min(1).default('1.0'),
  messageId: z.string().min(1).max(150),
  deviceId: z.string().min(1).max(150),
  siteId: z.string().min(1).max(150).optional().nullable(),
  sequence: z.number().int().nonnegative().optional().nullable(),
  recordedAt: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  data: SoilTelemetryDataSchema,
});

export type SoilTelemetryPayload = z.infer<typeof SoilTelemetryPayloadSchema>;

/**
 * DTO for persisting Soil Telemetry reading
 */
export interface IngestSoilTelemetryInput {
  deviceId: string;
  messageId: string;
  schemaVersion: string;
  sequenceNumber?: bigint | number | null;
  recordedAt?: Date | string | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  temperature?: number | null;
  moisture?: number | null;
  ph?: number | null;
  ec?: number | null;
  status?: string | null;
  validationStatus?: TelemetryValidationStatus | string;
}
