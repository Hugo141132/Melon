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
 * Shared Water Quality Telemetry Data Schema & Type
 * Source of truth: docs/DEVICE_COMMUNICATION.md §14, DEC-DEV-020, DEC-MON-086
 * Water-Quality monitoring domain (REST API over Wi-Fi).
 * BAT parameter is removed per DEC-MON-086 (superseding DEC-MON-085).
 * Latitude and Longitude parameters are deleted and must not be reintroduced.
 * Reservoir tankVolume parameter remains on the MQTT/IoT Gateway path (WATER_TANK_NODE, flowRate removed per DEC-MON-089).
 */
export const WaterTelemetryDataSchema = z.object({
  ph: z.number().finite().nullable().optional().default(null),
  tds: z.number().finite().nullable().optional().default(null),
  ec: z.number().finite().nullable().optional().default(null),
  status: z.nativeEnum(MonitoringStatus).nullable().optional().default(null),
});

export type WaterTelemetryData = z.infer<typeof WaterTelemetryDataSchema>;

/**
 * Water Telemetry Payload Envelope Schema & Type
 */
export const WaterTelemetryPayloadSchema = z.object({
  schemaVersion: z.string().min(1).default('1.0'),
  messageId: z.string().min(1).max(150),
  deviceId: z.string().min(1).max(150),
  siteId: z.string().min(1).max(150).optional().nullable(),
  sequence: z.number().int().nonnegative().optional().nullable(),
  recordedAt: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  data: WaterTelemetryDataSchema,
});

export type WaterTelemetryPayload = z.infer<typeof WaterTelemetryPayloadSchema>;

/**
 * DTO for persisting Water Quality Telemetry reading (REST API over Wi-Fi)
 */
export interface IngestWaterTelemetryInput {
  deviceId: string;
  messageId: string;
  schemaVersion: string;
  sequenceNumber?: bigint | number | null;
  recordedAt?: Date | string | null;
  ph?: number | null;
  tds?: number | null;
  ec?: number | null;
  status?: string | null;
  validationStatus?: TelemetryValidationStatus | string;
}

export interface WaterTelemetryIngestionResult {
  readingId: string;
  deviceId: string;
  canonicalDeviceId: string;
  messageId: string;
  recordedAt: Date | null;
  receivedAt: Date;
  isDuplicate: boolean;
  validationStatus: string;
}

/**
 * Shared Reservoir-Water Telemetry Data Schema & Type (Water Tank Node)
 * Source of truth: docs/DEVICE_COMMUNICATION.md §14.1, DEC-MON-089
 * Note: flowRate parameter is completely removed per DEC-MON-089.
 * Zod object strips any incoming legacy flowRate without rejecting remaining telemetry.
 */
export const ReservoirTelemetryDataSchema = z.object({
  tankVolume: z.number().finite().nullable().optional().default(null),
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
  status?: string | null;
  validationStatus?: TelemetryValidationStatus | string;
}

/**
 * Soil History Query Schema & Response DTOs
 * TASK-0503
 */
/**
 * Approved server-side history page size (TASK-0503).
 *
 * The page size is fixed by policy rather than negotiated per request: history
 * tables render exactly this many rows per page. A client may not widen it,
 * because that would reintroduce unbounded response payloads. The final page of
 * a range is allowed to return fewer rows when fewer remain.
 */
export const HISTORY_PAGE_SIZE = 5;

export const SoilHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  metrics: z.string().optional(),
  interval: z.string().optional(),
  /**
   * Normalized location identity to scope the query to.
   * Omit to return every retained reading (unnamed included); pass an empty
   * string to select only readings with no location assigned.
   */
  locationKey: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

/** Query parameters after server-side page-size enforcement. */
export type SoilHistoryQueryParams = z.infer<typeof SoilHistoryQuerySchema>;

export const SoilHistorySeriesItemSchema = z.object({
  timestamp: z.string(),
  nitrogen: z.number().nullable().optional(),
  phosphorus: z.number().nullable().optional(),
  potassium: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
  moisture: z.number().nullable().optional(),
  ph: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  // Immutable reading identity. Location annotations bind to this id, never to
  // the device's current location. Optional for backward compatibility with
  // responses produced before TASK-0503/TASK-0504.
  readingId: z.string().optional(),
  // Raw stored timestamp (never aggregated, interpolated or downsampled).
  recordedAt: z.string().optional(),
  receivedAt: z.string().optional(),
  // Location annotation. `null` means the reading is still unnamed, which
  // excludes it from charts (named-only eligibility).
  locationName: z.string().nullable().optional(),
  locationKey: z.string().nullable().optional(),
  locationAnnotatedAt: z.string().nullable().optional(),
  locationNamedBy: z
    .object({ id: z.string(), fullName: z.string(), email: z.string() })
    .nullable()
    .optional(),
});

export type SoilHistorySeriesItem = z.infer<typeof SoilHistorySeriesItemSchema>;

export const SoilHistoryResponseDtoSchema = z.object({
  deviceId: z.string(),
  from: z.string(),
  to: z.string(),
  interval: z.string().optional(),
  series: z.array(SoilHistorySeriesItemSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalRecords: z.number(),
    totalPages: z.number(),
  }),
});

export type SoilHistoryResponseDto = z.infer<typeof SoilHistoryResponseDtoSchema>;

/**
 * Water History Query Schema & Response DTOs
 * TASK-0503
 */
export const WaterHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  metrics: z.string().optional(),
  interval: z.string().optional(),
  /** See `SoilHistoryQuerySchema.locationKey`. */
  locationKey: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type WaterHistoryQueryParams = z.infer<typeof WaterHistoryQuerySchema>;

export const WaterHistorySeriesItemSchema = z.object({
  timestamp: z.string(),
  ph: z.number().nullable().optional(),
  tds: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  // See `SoilHistorySeriesItemSchema` for the annotation field rationale.
  readingId: z.string().optional(),
  recordedAt: z.string().optional(),
  receivedAt: z.string().optional(),
  locationName: z.string().nullable().optional(),
  locationKey: z.string().nullable().optional(),
  locationAnnotatedAt: z.string().nullable().optional(),
  locationNamedBy: z
    .object({ id: z.string(), fullName: z.string(), email: z.string() })
    .nullable()
    .optional(),
});

export type WaterHistorySeriesItem = z.infer<typeof WaterHistorySeriesItemSchema>;

export const WaterHistoryResponseDtoSchema = z.object({
  deviceId: z.string(),
  from: z.string(),
  to: z.string(),
  interval: z.string().optional(),
  series: z.array(WaterHistorySeriesItemSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalRecords: z.number(),
    totalPages: z.number(),
  }),
});

export type WaterHistoryResponseDto = z.infer<typeof WaterHistoryResponseDtoSchema>;

// ---------------------------------------------------------------------------
// TASK-0503 / TASK-0504 — Portable reading location annotations
// ---------------------------------------------------------------------------

/** Maximum stored length of a location annotation (matches the DB column). */
export const LOCATION_NAME_MAX_LENGTH = 120;

/**
 * Chart query for a single named location.
 *
 * `locationKey` is REQUIRED and must be non-blank. The chart is intentionally
 * unable to query across locations, because doing so would splice measurements
 * from different physical places into a single trend line.
 */
export const SoilChartQuerySchema = z.object({
  locationKey: z.string().trim().min(1, 'locationKey must not be blank.'),
  from: z.string().optional(),
  to: z.string().optional(),
  metrics: z.string().optional(),
  /**
   * Batch size for bounded keyset retrieval. Defaults to 1000 readings per batch.
   */
  limit: z.coerce.number().int().positive().max(2000).optional().default(1000),
  /**
   * Opaque keyset pagination cursor for batched retrieval (`${receivedAt}_${id}`).
   */
  cursor: z
    .string()
    .refine(
      (val) => {
        const sepIdx = val.indexOf('_');
        if (sepIdx === -1) return false;
        const dateStr = val.substring(0, sepIdx);
        const idStr = val.substring(sepIdx + 1);
        return !isNaN(new Date(dateStr).getTime()) && idStr.length > 0;
      },
      { message: 'Invalid or malformed pagination cursor. Expected format: {receivedAtIso}_{id}' }
    )
    .optional(),
});

export type SoilChartQuery = z.infer<typeof SoilChartQuerySchema>;

export const WaterChartQuerySchema = z.object({
  locationKey: z.string().trim().min(1, 'locationKey must not be blank.'),
  from: z.string().optional(),
  to: z.string().optional(),
  metrics: z.string().optional(),
  limit: z.coerce.number().int().positive().max(2000).optional().default(1000),
  cursor: z
    .string()
    .refine(
      (val) => {
        const sepIdx = val.indexOf('_');
        if (sepIdx === -1) return false;
        const dateStr = val.substring(0, sepIdx);
        const idStr = val.substring(sepIdx + 1);
        return !isNaN(new Date(dateStr).getTime()) && idStr.length > 0;
      },
      { message: 'Invalid or malformed pagination cursor. Expected format: {receivedAtIso}_{id}' }
    )
    .optional(),
});

export type WaterChartQuery = z.infer<typeof WaterChartQuerySchema>;

/**
 * Body for setting, renaming, or clearing one reading's location.
 *
 * `locationName: null` clears the annotation. A whitespace-only string is
 * rejected rather than treated as a clear, so an accidental space cannot wipe a
 * label that an operator deliberately typed.
 *
 * The acting user is NOT accepted here: attribution is derived server-side from
 * the authenticated session, so a client cannot annotate on someone else's behalf.
 */
export const ReadingLocationAnnotationSchema = z.object({
  locationName: z
    .string()
    .trim()
    .min(1, 'locationName must not be blank; send null to clear the location.')
    .max(
      LOCATION_NAME_MAX_LENGTH,
      `locationName must be at most ${LOCATION_NAME_MAX_LENGTH} characters.`
    )
    .nullable(),
});

export type ReadingLocationAnnotationRequest = z.infer<typeof ReadingLocationAnnotationSchema>;

/**
 * Reading identity used when binding a location onto a stored reading.
 *
 * Readings are addressed by their immutable UUID so that annotating one sample
 * can never be misapplied to a neighbouring row or to the device as a whole.
 */
export const ReadingIdSchema = z.string().uuid('readingId must be a valid reading UUID.');

export type ReadingLocationId = z.infer<typeof ReadingIdSchema>;

/** One annotated location offered in the location selector. */
export const ReadingLocationOptionSchema = z.object({
  locationKey: z.string(),
  locationName: z.string(),
  readingCount: z.number(),
  firstRecordedAt: z.string().nullable(),
  lastRecordedAt: z.string().nullable(),
});

export type ReadingLocationOption = z.infer<typeof ReadingLocationOptionSchema>;

/** Chart response: unaggregated readings for exactly one location. */
export const ReadingChartSeriesItemSchema = z.object({
  readingId: z.string(),
  timestamp: z.string(),
  nitrogen: z.number().nullable().optional(),
  phosphorus: z.number().nullable().optional(),
  potassium: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
  moisture: z.number().nullable().optional(),
  ph: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  tds: z.number().nullable().optional(),
});

export type ReadingChartSeriesItem = z.infer<typeof ReadingChartSeriesItemSchema>;

export const ReadingChartResponseDtoSchema = z.object({
  locationKey: z.string(),
  locationName: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  points: z.array(ReadingChartSeriesItemSchema),
  nextCursor: z.string().nullable().optional(),
  totalPoints: z.number().optional(),
  truncated: z.boolean().default(false),
});

export type ReadingChartResponseDto = z.infer<typeof ReadingChartResponseDtoSchema>;
