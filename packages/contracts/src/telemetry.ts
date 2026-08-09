import { z } from 'zod';
import { MonitoringStatus, TelemetryValidationStatus } from './enums';
import { DeviceTypeSchema, DeviceConnectionStatusSchema } from './device';

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

/**
 * Latest Soil Monitoring Response DTO Schema & Type
 * TASK-0501
 */
export const SoilMonitoringResponseDtoSchema = z.object({
  deviceId: z.string(),
  recordedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  isStale: z.boolean(),
  data: z.object({
    nitrogen: z.number().nullable(),
    phosphorus: z.number().nullable(),
    potassium: z.number().nullable(),
    temperature: z.number().nullable(),
    moisture: z.number().nullable(),
    ph: z.number().nullable(),
    ec: z.number().nullable(),
    status: z.string().nullable(),
  }),
});

export type SoilMonitoringResponseDto = z.infer<typeof SoilMonitoringResponseDtoSchema>;

/**
 * Latest Water Monitoring Response DTO Schema & Type
 * TASK-0501
 */
export const WaterMonitoringResponseDtoSchema = z.object({
  deviceId: z.string(),
  recordedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  isStale: z.boolean(),
  data: z.object({
    ph: z.number().nullable(),
    tds: z.number().nullable(),
    ec: z.number().nullable(),
    tankVolume: z.number().nullable(),
    flowRate: z.number().nullable(),
    status: z.string().nullable(),
  }),
});

export type WaterMonitoringResponseDto = z.infer<typeof WaterMonitoringResponseDtoSchema>;

/**
 * Combined Latest Monitoring Snapshot DTO Schema & Type
 * TASK-0501
 */
export const LatestMonitoringSnapshotDtoSchema = z.object({
  deviceId: z.string(),
  deviceType: DeviceTypeSchema,
  connectionStatus: DeviceConnectionStatusSchema,
  lastSeenAt: z.string().nullable(),
  soil: SoilMonitoringResponseDtoSchema.nullable(),
  water: WaterMonitoringResponseDtoSchema.nullable(),
});

export type LatestMonitoringSnapshotDto = z.infer<typeof LatestMonitoringSnapshotDtoSchema>;

/**
 * Shared Reservoir-Water Telemetry Data Schema & Type (Water Tank Node)
 * Source of truth: docs/DEVICE_COMMUNICATION.md §14.1
 */
export const ReservoirTelemetryDataSchema = z.object({
  tankVolume: z.number().finite().nullable().optional().default(null),
  flowRate: z.number().finite().nullable().optional().default(null),
  status: z.nativeEnum(MonitoringStatus).nullable().optional().default(null),
});

export type ReservoirTelemetryData = z.infer<typeof ReservoirTelemetryDataSchema>;

/**
 * Reservoir Telemetry Payload Envelope Schema & Type
 */
export const ReservoirTelemetryPayloadSchema = z.object({
  schemaVersion: z.string().min(1).default('1.0'),
  messageId: z.string().min(1).max(150),
  deviceId: z.string().min(1).max(150),
  siteId: z.string().min(1).max(150).optional().nullable(),
  sequence: z.number().int().nonnegative().optional().nullable(),
  recordedAt: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
  firmwareVersion: z.string().optional().nullable(),
  data: ReservoirTelemetryDataSchema,
});

export type ReservoirTelemetryPayload = z.infer<typeof ReservoirTelemetryPayloadSchema>;

/**
 * DTO for persisting Reservoir Water Telemetry reading
 */
export interface IngestReservoirTelemetryInput {
  deviceId: string;
  messageId: string;
  schemaVersion: string;
  sequenceNumber?: bigint | number | null;
  recordedAt?: Date | string | null;
  tankVolume?: number | null;
  flowRate?: number | null;
  status?: string | null;
  validationStatus?: TelemetryValidationStatus | string;
}
