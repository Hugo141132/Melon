import { PrismaClient, Prisma } from '@prisma/client';
import {
  IngestSoilTelemetryInput,
  IngestReservoirTelemetryInput,
  IngestWaterTelemetryInput,
  WaterTelemetryIngestionResult,
  TelemetryValidationStatus,
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
        ? { OR: [{ id: canonicalDeviceId }, { deviceId: canonicalDeviceId }] }
        : { deviceId: canonicalDeviceId },
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
        ? { OR: [{ id: canonicalDeviceId }, { deviceId: canonicalDeviceId }] }
        : { deviceId: canonicalDeviceId },
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
        const reading = await tx.reservoirWaterReading.create({
          data: {
            deviceId: device.id,
            messageId: input.messageId.trim(),
            sequenceNumber: input.sequenceNumber != null ? BigInt(input.sequenceNumber) : null,
            schemaVersion: input.schemaVersion || '1.0',
            recordedAt: recordedAtDate,
            receivedAt: serverReceivedAt,
            tankVolume: toDecimal(input.tankVolume),
            flowRate: toDecimal(input.flowRate),
            status: input.status || null,
            validationStatus: input.validationStatus || TelemetryValidationStatus.VALID,
          },
        });

        await tx.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: serverReceivedAt,
            lastMessageAt: serverReceivedAt,
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
        ? { OR: [{ id: canonicalDeviceId }, { deviceId: canonicalDeviceId }] }
        : { deviceId: canonicalDeviceId },
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
            // latitude and longitude deleted (left null)
            status: input.status || null,
            validationStatus: input.validationStatus || TelemetryValidationStatus.VALID,
          },
        });

        await tx.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: serverReceivedAt,
            lastMessageAt: serverReceivedAt,
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deviceIdentifier
    );
    return this.prisma.soilReading.findFirst({
      where: isUuid
        ? { OR: [{ deviceId: deviceIdentifier }, { device: { deviceId: deviceIdentifier } }] }
        : { device: { deviceId: deviceIdentifier } },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /**
   * Fetches the latest WaterReading for a given device internal UUID or canonical deviceId.
   */
  async getLatestWaterReading(deviceIdentifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deviceIdentifier
    );
    return this.prisma.waterReading.findFirst({
      where: isUuid
        ? { OR: [{ deviceId: deviceIdentifier }, { device: { deviceId: deviceIdentifier } }] }
        : { device: { deviceId: deviceIdentifier } },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /**
   * Fetches the latest ReservoirWaterReading (water tank) for a given device internal UUID or canonical deviceId.
   */
  async getLatestWaterTankReading(deviceIdentifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deviceIdentifier
    );
    return this.prisma.reservoirWaterReading.findFirst({
      where: isUuid
        ? { OR: [{ deviceId: deviceIdentifier }, { device: { deviceId: deviceIdentifier } }] }
        : { device: { deviceId: deviceIdentifier } },
      orderBy: { receivedAt: 'desc' },
    });
  }
}
