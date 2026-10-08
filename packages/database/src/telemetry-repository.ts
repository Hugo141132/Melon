import { PrismaClient, Prisma } from '@prisma/client';
import {
  IngestSoilTelemetryInput,
  IngestReservoirTelemetryInput,
  IngestWaterTelemetryInput,
  WaterTelemetryIngestionResult,
  TelemetryValidationStatus,
  DeviceConnectionStatus,
} from '@kebun-melon/contracts';
import { DeviceNotFoundError, DeviceInactiveError } from './device-repository';

export interface SoilTelemetryIngestionResult {
  readingId: string;
  deviceId: string;
  canonicalDeviceId: string;
  messageId: string;
  recordedAt: Date | null;
  receivedAt: Date;
  isDuplicate: boolean;
  validationStatus: string;
}

export type { WaterTelemetryIngestionResult };

/**
 * Maximum stored length of a location annotation.
 *
 * Kept in sync with the Prisma `location_name` / `location_key` VarChar(120)
 * column width and with `LOCATION_NAME_MAX_LENGTH` in the web request schema.
 */
export const LOCATION_NAME_MAX_LENGTH = 120;

/**
 * Normalizes a free-text location into a stable comparison identity.
 *
 * Portable soil and water-quality devices carry NO firmware location identifier,
 * so the operator-typed string is the only location identity available. Without
 * normalization, typing "Bed A", " bed a " and "BED A" would create three distinct
 * chart series for what is physically one location.
 *
 * Rules:
 *   - Trims leading/trailing whitespace.
 *   - Collapses internal whitespace runs to a single space.
 *   - Lowercases, because location identity is case-insensitive.
 *
 * Returns `null` for input that is empty or whitespace-only, which callers treat
 * as "no location assigned" (existing and unnamed readings stay unnamed).
 */
export function normalizeLocationKey(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const collapsed = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return collapsed.length === 0 ? null : collapsed;
}

/**
 * Normalizes a location for storage, truncating to the column width.
 *
 * The display value (`locationName`) is whitespace-collapsed so the table does not
 * render ragged padding, but otherwise keeps the operator's original casing.
 */
export function normalizeLocationDisplay(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const collapsed = raw.trim().replace(/\s+/g, ' ');
  return collapsed.length === 0 ? null : collapsed.slice(0, LOCATION_NAME_MAX_LENGTH);
}

export interface ReadingLocationAnnotation {
  readingId: string;
  locationName: string | null;
  locationKey: string | null;
  annotatedAt: Date | null;
  namedBy: { id: string; fullName: string; email: string } | null;
  previousLocationName: string | null;
}

export interface ReadingLocationOption {
  locationKey: string;
  locationName: string;
  readingCount: number;
  firstRecordedAt: Date | null;
  lastRecordedAt: Date | null;
}

export interface ReservoirTelemetryIngestionResult {
  readingId: string;
  deviceId: string;
  canonicalDeviceId: string;
  messageId: string;
  recordedAt: Date | null;
  receivedAt: Date;
  isDuplicate: boolean;
  validationStatus: string;
}

export class TelemetryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Ingests a single Soil Telemetry reading into `soil_readings` and atomically updates target device `lastSeenAt`.
   * Enforces idempotency via unique constraint on (device_id, message_id).
   */
  async ingestSoilReading(input: IngestSoilTelemetryInput): Promise<SoilTelemetryIngestionResult> {
    const canonicalDeviceId = input.deviceId.trim();

    // 1. Resolve target device by canonical deviceId (or UUID id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true, deviceId: true, accountStatus: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    if (device.accountStatus !== 'ACTIVE') {
      throw new DeviceInactiveError(`Device '${canonicalDeviceId}' is not active.`);
    }

    const serverReceivedAt = new Date();
    let recordedAtDate: Date | null = null;
    if (input.recordedAt) {
      const d = input.recordedAt instanceof Date ? input.recordedAt : new Date(input.recordedAt);
      if (!isNaN(d.getTime())) {
        recordedAtDate = d;
      }
    }

    const toDecimal = (val: number | null | undefined): Prisma.Decimal | null => {
      if (val === null || val === undefined) return null;
      return new Prisma.Decimal(val);
    };

    try {
      // 2. Perform atomic transaction: insert soil_reading AND update device lastSeenAt
      const result = await this.prisma.$transaction(async (tx) => {
        const reading = await tx.soilReading.create({
          data: {
            deviceId: device.id,
            messageId: input.messageId.trim(),
            sequenceNumber: input.sequenceNumber != null ? BigInt(input.sequenceNumber) : null,
            schemaVersion: input.schemaVersion || '1.0',
            recordedAt: recordedAtDate,
            receivedAt: serverReceivedAt,
            nitrogen: toDecimal(input.nitrogen),
            phosphorus: toDecimal(input.phosphorus),
            potassium: toDecimal(input.potassium),
            temperature: toDecimal(input.temperature),
            moisture: toDecimal(input.moisture),
            ph: toDecimal(input.ph),
            ec: toDecimal(input.ec),
            status: input.status || null,
            validationStatus: input.validationStatus || TelemetryValidationStatus.VALID,
          },
        });

        await tx.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: serverReceivedAt,
            lastMessageAt: serverReceivedAt,
            connectionStatus: DeviceConnectionStatus.ONLINE,
          },
        });

        return reading;
      });

      return {
        readingId: result.id,
        deviceId: device.id,
        canonicalDeviceId: device.deviceId,
        messageId: result.messageId,
        recordedAt: result.recordedAt,
        receivedAt: result.receivedAt,
        isDuplicate: false,
        validationStatus: result.validationStatus,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.soilReading.findUnique({
          where: {
            deviceId_messageId: {
              deviceId: device.id,
              messageId: input.messageId.trim(),
            },
          },
        });

        if (existing) {
          return {
            readingId: existing.id,
            deviceId: device.id,
            canonicalDeviceId: device.deviceId,
            messageId: existing.messageId,
            recordedAt: existing.recordedAt,
            receivedAt: existing.receivedAt,
            isDuplicate: true,
            validationStatus: existing.validationStatus,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Ingests a single Reservoir Water Telemetry reading into `reservoir_water_readings` and atomically updates target device `lastSeenAt`.
   * Enforces idempotency via unique constraint on (device_id, message_id).
   */
  async ingestReservoirReading(
    input: IngestReservoirTelemetryInput
  ): Promise<ReservoirTelemetryIngestionResult> {
    const canonicalDeviceId = input.deviceId.trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true, deviceId: true, accountStatus: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    if (device.accountStatus !== 'ACTIVE') {
      throw new DeviceInactiveError(`Device '${canonicalDeviceId}' is not active.`);
    }

    const serverReceivedAt = new Date();
    let recordedAtDate: Date | null = null;
    if (input.recordedAt) {
      const d = input.recordedAt instanceof Date ? input.recordedAt : new Date(input.recordedAt);
      if (!isNaN(d.getTime())) {
        recordedAtDate = d;
      }
    }

    const toDecimal = (val: number | null | undefined): Prisma.Decimal | null => {
      if (val === null || val === undefined) return null;
      return new Prisma.Decimal(val);
    };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Acquire device-level row lock first to serialize concurrent writes for the same device
        await tx.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: serverReceivedAt,
            lastMessageAt: serverReceivedAt,
            connectionStatus: DeviceConnectionStatus.ONLINE,
          },
        });

        // 2. Insert new reservoir reading
        const reading = await tx.reservoirWaterReading.create({
          data: {
            deviceId: device.id,
            messageId: input.messageId.trim(),
            sequenceNumber: input.sequenceNumber != null ? BigInt(input.sequenceNumber) : null,
            schemaVersion: input.schemaVersion || '1.0',
            recordedAt: recordedAtDate,
            receivedAt: serverReceivedAt,
            tankVolume: toDecimal(input.tankVolume),
            status: input.status || null,
            validationStatus: input.validationStatus || TelemetryValidationStatus.VALID,
          },
        });

        // 3. Enforce deterministic latest-5 retention per device (DEC-MON-092)
        const recordsToKeep = await tx.reservoirWaterReading.findMany({
          where: { deviceId: device.id },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: { id: true },
        });

        if (recordsToKeep && recordsToKeep.length >= 5) {
          const keepIds = recordsToKeep.map((r: { id: string }) => r.id);
          if (typeof tx.reservoirWaterReading.deleteMany === 'function') {
            await tx.reservoirWaterReading.deleteMany({
              where: {
                deviceId: device.id,
                id: { notIn: keepIds },
              },
            });
          }
        }

        return reading;
      });

      return {
        readingId: result.id,
        deviceId: device.id,
        canonicalDeviceId: device.deviceId,
        messageId: result.messageId,
        recordedAt: result.recordedAt,
        receivedAt: result.receivedAt,
        isDuplicate: false,
        validationStatus: result.validationStatus,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.reservoirWaterReading.findUnique({
          where: {
            deviceId_messageId: {
              deviceId: device.id,
              messageId: input.messageId.trim(),
            },
          },
        });

        if (existing) {
          return {
            readingId: existing.id,
            deviceId: device.id,
            canonicalDeviceId: device.deviceId,
            messageId: existing.messageId,
            recordedAt: existing.recordedAt,
            receivedAt: existing.receivedAt,
            isDuplicate: true,
            validationStatus: existing.validationStatus,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Ingests a single Water Quality Telemetry reading into `water_readings` and atomically updates target device `lastSeenAt`.
   * BAT parameter is removed per DEC-MON-086 (superseding DEC-MON-085).
   * Enforces idempotency via unique constraint on (device_id, message_id).
   */
  async ingestWaterReading(
    input: IngestWaterTelemetryInput
  ): Promise<WaterTelemetryIngestionResult> {
    const canonicalDeviceId = input.deviceId.trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true, deviceId: true, accountStatus: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    if (device.accountStatus !== 'ACTIVE') {
      throw new DeviceInactiveError(`Device '${canonicalDeviceId}' is not active.`);
    }

    const serverReceivedAt = new Date();
    let recordedAtDate: Date | null = null;
    if (input.recordedAt) {
      const d = input.recordedAt instanceof Date ? input.recordedAt : new Date(input.recordedAt);
      if (!isNaN(d.getTime())) {
        recordedAtDate = d;
      }
    }

    const toDecimal = (val: number | null | undefined): Prisma.Decimal | null => {
      if (val === null || val === undefined) return null;
      return new Prisma.Decimal(val);
    };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const reading = await tx.waterReading.create({
          data: {
            deviceId: device.id,
            messageId: input.messageId.trim(),
            sequenceNumber: input.sequenceNumber != null ? BigInt(input.sequenceNumber) : null,
            schemaVersion: input.schemaVersion || '1.0',
            recordedAt: recordedAtDate,
            receivedAt: serverReceivedAt,
            ph: toDecimal(input.ph),
            tds: toDecimal(input.tds),
            ec: toDecimal(input.ec),
            status: input.status || null,
            validationStatus: input.validationStatus || TelemetryValidationStatus.VALID,
          },
        });

        await tx.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: serverReceivedAt,
            lastMessageAt: serverReceivedAt,
            connectionStatus: DeviceConnectionStatus.ONLINE,
          },
        });

        return reading;
      });

      return {
        readingId: result.id,
        deviceId: device.id,
        canonicalDeviceId: device.deviceId,
        messageId: result.messageId,
        recordedAt: result.recordedAt,
        receivedAt: result.receivedAt,
        isDuplicate: false,
        validationStatus: result.validationStatus,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.waterReading.findUnique({
          where: {
            deviceId_messageId: {
              deviceId: device.id,
              messageId: input.messageId.trim(),
            },
          },
        });

        if (existing) {
          return {
            readingId: existing.id,
            deviceId: device.id,
            canonicalDeviceId: device.deviceId,
            messageId: existing.messageId,
            recordedAt: existing.recordedAt,
            receivedAt: existing.receivedAt,
            isDuplicate: true,
            validationStatus: existing.validationStatus,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Fetches the latest SoilReading for a given device internal UUID or canonical deviceId.
   */
  async getLatestSoilReading(deviceIdentifier: string) {
    const cleanId = deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    return this.prisma.soilReading.findFirst({
      where: isUuid
        ? {
            OR: [
              { deviceId: cleanId },
              { device: { deviceId: cleanId } },
              { device: { deviceId: { equals: cleanId, mode: 'insensitive' } } },
            ],
          }
        : {
            device: {
              OR: [{ deviceId: cleanId }, { deviceId: { equals: cleanId, mode: 'insensitive' } }],
            },
          },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /**
   * Fetches the latest WaterReading for a given device internal UUID or canonical deviceId.
   */
  async getLatestWaterReading(deviceIdentifier: string) {
    const cleanId = deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    return this.prisma.waterReading.findFirst({
      where: isUuid
        ? {
            OR: [
              { deviceId: cleanId },
              { device: { deviceId: cleanId } },
              { device: { deviceId: { equals: cleanId, mode: 'insensitive' } } },
            ],
          }
        : {
            device: {
              OR: [{ deviceId: cleanId }, { deviceId: { equals: cleanId, mode: 'insensitive' } }],
            },
          },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /**
   * Fetches the latest ReservoirWaterReading (water tank) for a given device internal UUID or canonical deviceId.
   */
  async getLatestWaterTankReading(deviceIdentifier: string) {
    const cleanId = deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    return this.prisma.reservoirWaterReading.findFirst({
      where: isUuid
        ? {
            OR: [
              { deviceId: cleanId },
              { device: { deviceId: cleanId } },
              { device: { deviceId: { equals: cleanId, mode: 'insensitive' } } },
            ],
          }
        : {
            device: {
              OR: [{ deviceId: cleanId }, { deviceId: { equals: cleanId, mode: 'insensitive' } }],
            },
          },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Prunes existing excess reservoir readings across all devices, retaining strictly
   * the latest N records per device (default: 5) ordered deterministically by receivedAt desc, id desc.
   * (DEC-MON-092 / TASK-0917)
   */
  async pruneExcessReservoirReadings(keepCount: number = 5): Promise<number> {
    if (typeof (this.prisma as any).$executeRaw === 'function') {
      return (this.prisma as any).$executeRaw`
        DELETE FROM "reservoir_water_readings"
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY device_id
                     ORDER BY received_at DESC, id DESC
                   ) as rn
            FROM "reservoir_water_readings"
          ) sub
          WHERE sub.rn > ${keepCount}
        )
      `;
    }
    return 0;
  }

  /**
   * Fetches historical Soil Telemetry readings for a given device within a validated date range.
   * TASK-0503
   */
  async getSoilHistory(options: {
    deviceIdentifier: string;
    from: Date;
    to: Date;
    metrics?: string[];
    page?: number;
    pageSize?: number;
    /**
     * Normalized location identity to filter by. When provided, only readings
     * annotated with that exact location are returned, which is what keeps the
     * chart from connecting different physical locations into one trend.
     */
    locationKey?: string | null;
  }) {
    const canonicalDeviceId = options.deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true, deviceId: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    const page = options.page || 1;
    // TASK-0503/TASK-0504: the approved history page size is exactly 5 readings.
    // The server owns this default so pagination stays consistent even when a
    // caller omits `pageSize`; clients render the control from the same value.
    const pageSize = options.pageSize || 5;

    const whereClause: Prisma.SoilReadingWhereInput = {
      deviceId: device.id,
      receivedAt: {
        gte: options.from,
        lte: options.to,
      },
      // Unnamed readings remain reachable: omitting `locationKey` returns everything,
      // and passing an explicit empty value is treated as "no location assigned".
      ...(options.locationKey !== undefined
        ? {
            locationKey:
              options.locationKey === null ? null : normalizeLocationKey(options.locationKey),
          }
        : {}),
    };

    const filterMetric = (field: string) => {
      if (!options.metrics || options.metrics.length === 0) return true;
      return options.metrics.includes(field);
    };

    const totalRecords = await this.prisma.soilReading.count({ where: whereClause });
    const skip = (page - 1) * pageSize;

    const readings = await this.prisma.soilReading.findMany({
      where: whereClause,
      // Deterministic ordering: `receivedAt` plus an `id` tiebreaker. Portable
      // devices can publish several readings inside the same millisecond, and a
      // non-deterministic order would let new rows reshuffle older pages.
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        nitrogen: true,
        phosphorus: true,
        potassium: true,
        temperature: true,
        moisture: true,
        ph: true,
        ec: true,
        status: true,
        recordedAt: true,
        receivedAt: true,
        locationName: true,
        locationKey: true,
        locationAnnotatedAt: true,
        namedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    const series = readings.map((r) => {
      const item: Record<string, any> = {
        timestamp: (r.recordedAt || r.receivedAt).toISOString(),
        readingId: r.id,
        recordedAt: (r.recordedAt || r.receivedAt).toISOString(),
        receivedAt: r.receivedAt.toISOString(),
        locationName: r.locationName ?? null,
        locationKey: r.locationKey ?? null,
        locationAnnotatedAt: r.locationAnnotatedAt ? r.locationAnnotatedAt.toISOString() : null,
        locationNamedBy: r.namedByUser
          ? { id: r.namedByUser.id, fullName: r.namedByUser.fullName, email: r.namedByUser.email }
          : null,
      };
      if (filterMetric('nitrogen')) item.nitrogen = toNumberOrNull(r.nitrogen);
      if (filterMetric('phosphorus')) item.phosphorus = toNumberOrNull(r.phosphorus);
      if (filterMetric('potassium')) item.potassium = toNumberOrNull(r.potassium);
      if (filterMetric('temperature')) item.temperature = toNumberOrNull(r.temperature);
      if (filterMetric('moisture')) item.moisture = toNumberOrNull(r.moisture);
      if (filterMetric('ph')) item.ph = toNumberOrNull(r.ph);
      if (filterMetric('ec')) item.ec = toNumberOrNull(r.ec);
      if (filterMetric('status')) item.status = r.status || null;
      return item;
    });

    return {
      deviceId: device.deviceId,
      from: options.from.toISOString(),
      to: options.to.toISOString(),
      series,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize) || 1,
      },
    };
  }

  /**
   * Fetches historical Water Quality and Reservoir Telemetry readings for a device.
   * TASK-0503
   */
  async getWaterHistory(options: {
    deviceIdentifier: string;
    from: Date;
    to: Date;
    metrics?: string[];
    page?: number;
    pageSize?: number;
    /** See `getSoilHistory`. */
    locationKey?: string | null;
  }) {
    const canonicalDeviceId = options.deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true, deviceId: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    const page = options.page || 1;
    // TASK-0503/TASK-0504: the approved history page size is exactly 5 readings.
    // The server owns this default so pagination stays consistent even when a
    // caller omits `pageSize`; clients render the control from the same value.
    const pageSize = options.pageSize || 5;

    const filterMetric = (field: string) => {
      if (!options.metrics || options.metrics.length === 0) return true;
      return options.metrics.includes(field);
    };

    const waterWhere: Prisma.WaterReadingWhereInput = {
      deviceId: device.id,
      receivedAt: { gte: options.from, lte: options.to },
      ...(options.locationKey !== undefined
        ? {
            locationKey:
              options.locationKey === null ? null : normalizeLocationKey(options.locationKey),
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;
    const totalRecords = await this.prisma.waterReading.count({ where: waterWhere });

    const waterReadings = await this.prisma.waterReading.findMany({
      where: waterWhere,
      // Deterministic ordering, matching `getSoilHistory`.
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        ph: true,
        tds: true,
        ec: true,
        status: true,
        recordedAt: true,
        receivedAt: true,
        locationName: true,
        locationKey: true,
        locationAnnotatedAt: true,
        namedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    const series = waterReadings.map((w) => {
      const item: Record<string, any> = {
        timestamp: (w.recordedAt || w.receivedAt).toISOString(),
        readingId: w.id,
        recordedAt: (w.recordedAt || w.receivedAt).toISOString(),
        receivedAt: w.receivedAt.toISOString(),
        locationName: w.locationName ?? null,
        locationKey: w.locationKey ?? null,
        locationAnnotatedAt: w.locationAnnotatedAt ? w.locationAnnotatedAt.toISOString() : null,
        locationNamedBy: w.namedByUser
          ? { id: w.namedByUser.id, fullName: w.namedByUser.fullName, email: w.namedByUser.email }
          : null,
      };
      if (filterMetric('ph')) item.ph = toNumberOrNull(w.ph);
      if (filterMetric('tds')) item.tds = toNumberOrNull(w.tds);
      if (filterMetric('ec')) item.ec = toNumberOrNull(w.ec);
      if (filterMetric('status')) item.status = w.status || null;
      return item;
    });

    return {
      deviceId: device.deviceId,
      from: options.from.toISOString(),
      to: options.to.toISOString(),
      series,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize) || 1,
      },
    };
  }

  /**
   * Lists distinct annotated locations for a device, newest-activity first.
   *
   * Uses the normalized `locationKey` as the identity so whitespace and case
   * variants collapse into one option, and takes the most recent `locationName`
   * for display so the label reflects how the location was last written.
   */
  async getSoilReadingLocations(deviceIdentifier: string): Promise<ReadingLocationOption[]> {
    const device = await this.resolveDeviceId(deviceIdentifier);

    const grouped = await this.prisma.$queryRaw<
      Array<{
        location_key: string;
        location_name: string;
        reading_count: bigint;
        first_recorded_at: Date | null;
        last_recorded_at: Date | null;
      }>
    >`
      SELECT location_key,
             (ARRAY_AGG(location_name ORDER BY location_annotated_at DESC NULLS LAST))[1] AS location_name,
             COUNT(*)::bigint AS reading_count,
             MIN(COALESCE(recorded_at, received_at)) AS first_recorded_at,
             MAX(COALESCE(recorded_at, received_at)) AS last_recorded_at
      FROM soil_readings
      WHERE device_id = ${device}::uuid
        AND location_key IS NOT NULL
      GROUP BY location_key
      ORDER BY last_recorded_at DESC NULLS LAST
      LIMIT 200
    `;

    return grouped.map((row) => ({
      locationKey: row.location_key,
      locationName: row.location_name,
      readingCount: Number(row.reading_count),
      firstRecordedAt: row.first_recorded_at,
      lastRecordedAt: row.last_recorded_at,
    }));
  }

  /**
   * Sets, renames, or clears the location annotation on one immutable soil reading.
   *
   * The update is scoped by reading id AND device id, so a reading belonging to a
   * different device cannot be reached through this path even with a valid id.
   * Returns the previous location so the caller can record it in the audit log,
   * keeping the full edit history outside the readings table itself.
   */
  async setSoilReadingLocation(params: {
    deviceIdentifier: string;
    readingId: string;
    locationName: string | null;
    namedByUserId: string;
  }): Promise<{ applied: boolean; previousLocationName: string | null; readingId: string }> {
    const deviceId = await this.resolveDeviceId(params.deviceIdentifier);

    const existing = await this.prisma.soilReading.findFirst({
      where: { id: params.readingId, deviceId },
      select: { id: true, locationName: true },
    });

    if (!existing) {
      return { applied: false, previousLocationName: null, readingId: params.readingId };
    }

    const display = normalizeLocationDisplay(params.locationName);
    const key = normalizeLocationKey(params.locationName);

    await this.prisma.soilReading.update({
      where: { id: existing.id },
      data:
        key === null
          ? {
              // Clearing resets the attribution too: an unnamed reading has no
              // meaningful "named by", and leaving it would misrepresent who
              // last touched the record.
              locationName: null,
              locationKey: null,
              locationAnnotatedAt: null,
              locationNamedById: null,
            }
          : {
              locationName: display,
              locationKey: key,
              locationAnnotatedAt: new Date(),
              locationNamedById: params.namedByUserId,
            },
    });

    return {
      applied: true,
      previousLocationName: existing.locationName ?? null,
      readingId: existing.id,
    };
  }

  /**
   * Named-only chart series for one soil location within a bounded window.
   *
   * `locationKey` is REQUIRED (never optional) because the chart must never mix
   * measurements taken at different physical locations into one line. Callers are
   * expected to pass a location the operator explicitly selected.
   *
   * Supports bounded keyset cursor pagination on `[receivedAt, id]` for complete,
   * non-aggregating retrieval without unbounded memory spikes or query timeouts.
   */
  async getSoilChartSeries(params: {
    deviceIdentifier: string;
    locationKey: string;
    from: Date;
    to: Date;
    limit?: number;
    cursor?: string | null;
  }) {
    const deviceId = await this.resolveDeviceId(params.deviceIdentifier);
    const locationKey = normalizeLocationKey(params.locationKey);

    if (!locationKey) {
      throw new Error('A non-blank locationKey is required for chart queries.');
    }

    const limit = Math.min(Math.max(params.limit ?? 1000, 1), 2000);

    let cursorFilter: Prisma.SoilReadingWhereInput = {};
    if (params.cursor) {
      const sepIdx = params.cursor.indexOf('_');
      if (sepIdx === -1) {
        throw new Error('Invalid or malformed pagination cursor.');
      }
      const cursorReceivedAtStr = params.cursor.substring(0, sepIdx);
      const cursorId = params.cursor.substring(sepIdx + 1);
      const cursorDate = new Date(cursorReceivedAtStr);
      if (isNaN(cursorDate.getTime()) || !cursorId) {
        throw new Error('Invalid or malformed pagination cursor.');
      }
      cursorFilter = {
        OR: [{ receivedAt: { gt: cursorDate } }, { receivedAt: cursorDate, id: { gt: cursorId } }],
      };
    }

    const baseWhere: Prisma.SoilReadingWhereInput = {
      deviceId,
      locationKey,
      receivedAt: { gte: params.from, lte: params.to },
    };

    const where: Prisma.SoilReadingWhereInput = {
      ...baseWhere,
      ...cursorFilter,
    };

    // Count is evaluated on the initial query without cursor
    const [totalRows, rows] = await Promise.all([
      !params.cursor
        ? this.prisma.soilReading.count({ where: baseWhere })
        : Promise.resolve(undefined),
      this.prisma.soilReading.findMany({
        where,
        // Deterministic ascending keyset ordering on [receivedAt, id]
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          nitrogen: true,
          phosphorus: true,
          potassium: true,
          temperature: true,
          moisture: true,
          ph: true,
          ec: true,
          recordedAt: true,
          receivedAt: true,
          locationName: true,
        },
      }),
    ]);

    let nextCursor: string | null = null;
    if (rows.length === limit) {
      const lastRow = rows[rows.length - 1];
      nextCursor = `${lastRow.receivedAt.toISOString()}_${lastRow.id}`;
    }

    // Preserve actual sensor recordedAt chronological order for display
    const ordered = [...rows].sort((a, b) => {
      const at = a.recordedAt ?? a.receivedAt;
      const bt = b.recordedAt ?? b.receivedAt;
      if (at.getTime() !== bt.getTime()) return at.getTime() - bt.getTime();
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return {
      locationKey,
      locationName: rows[0]?.locationName ?? null,
      series: ordered.map((r) => ({
        readingId: r.id,
        timestamp: (r.recordedAt || r.receivedAt).toISOString(),
        recordedAt: (r.recordedAt || r.receivedAt).toISOString(),
        receivedAt: r.receivedAt.toISOString(),
        nitrogen: toNumberOrNull(r.nitrogen),
        phosphorus: toNumberOrNull(r.phosphorus),
        potassium: toNumberOrNull(r.potassium),
        temperature: toNumberOrNull(r.temperature),
        moisture: toNumberOrNull(r.moisture),
        ph: toNumberOrNull(r.ph),
        ec: toNumberOrNull(r.ec),
      })),
      nextCursor,
      totalRows,
      truncated: false,
    };
  }

  /** Lists distinct annotated water-quality locations for a device. */
  async getWaterReadingLocations(deviceIdentifier: string): Promise<ReadingLocationOption[]> {
    const device = await this.resolveDeviceId(deviceIdentifier);

    const grouped = await this.prisma.$queryRaw<
      Array<{
        location_key: string;
        location_name: string;
        reading_count: bigint;
        first_recorded_at: Date | null;
        last_recorded_at: Date | null;
      }>
    >`
      SELECT location_key,
             (ARRAY_AGG(location_name ORDER BY location_annotated_at DESC NULLS LAST))[1] AS location_name,
             COUNT(*)::bigint AS reading_count,
             MIN(COALESCE(recorded_at, received_at)) AS first_recorded_at,
             MAX(COALESCE(recorded_at, received_at)) AS last_recorded_at
      FROM water_readings
      WHERE device_id = ${device}::uuid
        AND location_key IS NOT NULL
      GROUP BY location_key
      ORDER BY last_recorded_at DESC NULLS LAST
      LIMIT 200
    `;

    return grouped.map((row) => ({
      locationKey: row.location_key,
      locationName: row.location_name,
      readingCount: Number(row.reading_count),
      firstRecordedAt: row.first_recorded_at,
      lastRecordedAt: row.last_recorded_at,
    }));
  }

  /** Sets, renames, or clears the location annotation on one immutable water reading. */
  async setWaterReadingLocation(params: {
    deviceIdentifier: string;
    readingId: string;
    locationName: string | null;
    namedByUserId: string;
  }): Promise<{ applied: boolean; previousLocationName: string | null; readingId: string }> {
    const deviceId = await this.resolveDeviceId(params.deviceIdentifier);

    const existing = await this.prisma.waterReading.findFirst({
      where: { id: params.readingId, deviceId },
      select: { id: true, locationName: true },
    });

    if (!existing) {
      return { applied: false, previousLocationName: null, readingId: params.readingId };
    }

    const display = normalizeLocationDisplay(params.locationName);
    const key = normalizeLocationKey(params.locationName);

    await this.prisma.waterReading.update({
      where: { id: existing.id },
      data:
        key === null
          ? {
              locationName: null,
              locationKey: null,
              locationAnnotatedAt: null,
              locationNamedById: null,
            }
          : {
              locationName: display,
              locationKey: key,
              locationAnnotatedAt: new Date(),
              locationNamedById: params.namedByUserId,
            },
    });

    return {
      applied: true,
      previousLocationName: existing.locationName ?? null,
      readingId: existing.id,
    };
  }

  /**
   * Named-only chart series for one water-quality location within a bounded window.
   *
   * Mirrors `getSoilChartSeries`: a location is mandatory and no aggregation is
   * applied, so every stored reading is charted at its actual timestamp.
   *
   * Supports bounded keyset cursor pagination on `[receivedAt, id]` for complete,
   * non-aggregating retrieval without unbounded memory spikes or query timeouts.
   */
  async getWaterChartSeries(params: {
    deviceIdentifier: string;
    locationKey: string;
    from: Date;
    to: Date;
    limit?: number;
    cursor?: string | null;
  }) {
    const deviceId = await this.resolveDeviceId(params.deviceIdentifier);
    const locationKey = normalizeLocationKey(params.locationKey);

    if (!locationKey) {
      throw new Error('A non-blank locationKey is required for chart queries.');
    }

    const limit = Math.min(Math.max(params.limit ?? 1000, 1), 2000);

    let cursorFilter: Prisma.WaterReadingWhereInput = {};
    if (params.cursor) {
      const sepIdx = params.cursor.indexOf('_');
      if (sepIdx === -1) {
        throw new Error('Invalid or malformed pagination cursor.');
      }
      const cursorReceivedAtStr = params.cursor.substring(0, sepIdx);
      const cursorId = params.cursor.substring(sepIdx + 1);
      const cursorDate = new Date(cursorReceivedAtStr);
      if (isNaN(cursorDate.getTime()) || !cursorId) {
        throw new Error('Invalid or malformed pagination cursor.');
      }
      cursorFilter = {
        OR: [{ receivedAt: { gt: cursorDate } }, { receivedAt: cursorDate, id: { gt: cursorId } }],
      };
    }

    const baseWhere: Prisma.WaterReadingWhereInput = {
      deviceId,
      locationKey,
      receivedAt: { gte: params.from, lte: params.to },
    };

    const where: Prisma.WaterReadingWhereInput = {
      ...baseWhere,
      ...cursorFilter,
    };

    const [totalRows, rows] = await Promise.all([
      !params.cursor
        ? this.prisma.waterReading.count({ where: baseWhere })
        : Promise.resolve(undefined),
      this.prisma.waterReading.findMany({
        where,
        // Deterministic ascending keyset ordering on [receivedAt, id]
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          ph: true,
          tds: true,
          ec: true,
          recordedAt: true,
          receivedAt: true,
          locationName: true,
        },
      }),
    ]);

    let nextCursor: string | null = null;
    if (rows.length === limit) {
      const lastRow = rows[rows.length - 1];
      nextCursor = `${lastRow.receivedAt.toISOString()}_${lastRow.id}`;
    }

    // Preserve actual sensor recordedAt chronological order for display
    const ordered = [...rows].sort((a, b) => {
      const at = a.recordedAt ?? a.receivedAt;
      const bt = b.recordedAt ?? b.receivedAt;
      if (at.getTime() !== bt.getTime()) return at.getTime() - bt.getTime();
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return {
      locationKey,
      locationName: rows[0]?.locationName ?? null,
      series: ordered.map((r) => ({
        readingId: r.id,
        timestamp: (r.recordedAt || r.receivedAt).toISOString(),
        recordedAt: (r.recordedAt || r.receivedAt).toISOString(),
        receivedAt: r.receivedAt.toISOString(),
        ph: toNumberOrNull(r.ph),
        tds: toNumberOrNull(r.tds),
        ec: toNumberOrNull(r.ec),
      })),
      nextCursor,
      totalRows,
      truncated: false,
    };
  }

  /**
   * Resolves a device by internal id or by firmware identifier.
   *
   * Returns the immutable internal `devices.id` used by every reading foreign key.
   */
  private async resolveDeviceId(deviceIdentifier: string): Promise<string> {
    const canonicalDeviceId = deviceIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalDeviceId
    );

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: canonicalDeviceId },
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { deviceId: canonicalDeviceId },
              { deviceId: { equals: canonicalDeviceId, mode: 'insensitive' } },
            ],
          },
      select: { id: true },
    });

    if (!device) {
      throw new DeviceNotFoundError(`Device '${canonicalDeviceId}' not found.`);
    }

    return device.id;
  }
}

function toNumberOrNull(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    return val.toNumber();
  }
  const num = Number(val);
  return isNaN(num) ? null : num;
}
