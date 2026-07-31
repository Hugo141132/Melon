import { z } from 'zod';

export enum DeviceType {
  SOIL_NODE = 'SOIL_NODE',
  WATER_QUALITY_NODE = 'WATER_QUALITY_NODE',
  WATER_TANK_NODE = 'WATER_TANK_NODE',
}

/**
 * Supported device types allowed for NEW device creation.
 */
export const NEW_DEVICE_TYPES = [
  DeviceType.SOIL_NODE,
  DeviceType.WATER_QUALITY_NODE,
  DeviceType.WATER_TANK_NODE,
] as const;

export const NewDeviceTypeSchema = z.enum([
  DeviceType.SOIL_NODE,
  DeviceType.WATER_QUALITY_NODE,
  DeviceType.WATER_TANK_NODE,
]);

/**
 * Server-Enforced Canonical Monitoring Parameters per Device Type
 */
export const SOIL_NODE_MONITORING_PARAMETERS = [
  'SOIL_NITROGEN',
  'SOIL_PHOSPHORUS',
  'SOIL_POTASSIUM',
  'SOIL_TEMPERATURE',
  'SOIL_MOISTURE',
  'SOIL_PH',
  'SOIL_EC',
] as const;

export const WATER_QUALITY_NODE_MONITORING_PARAMETERS = [
  'WATER_PH',
  'WATER_TDS',
  'WATER_EC',
] as const;

export const WATER_TANK_NODE_MONITORING_PARAMETERS = [
  'WATER_TANK_VOLUME',
  'WATER_FLOW_RATE',
] as const;

export const WATER_TANK_NODE_CONTROL_CAPABILITIES = ['FAUCET_CONTROL'] as const;

export enum CapabilityCategory {
  MONITORING = 'MONITORING',
  CONTROL = 'CONTROL',
}

/**
 * Classifies a capability into MONITORING or CONTROL.
 */
export function getCapabilityCategory(capability: string): CapabilityCategory {
  if (capability === 'FAUCET_CONTROL') {
    return CapabilityCategory.CONTROL;
  }
  return CapabilityCategory.MONITORING;
}

/**
 * Feature detection helper to check if a device supports an active, enabled capability.
 * Returns false if capability is missing or if enabled === false.
 */
export function supportsCapability(
  device:
    | {
        capabilities?: string[] | { capability: string; enabled?: boolean }[];
      }
    | null
    | undefined,
  capability: string
): boolean {
  if (!device || !device.capabilities || !Array.isArray(device.capabilities)) {
    return false;
  }

  for (const item of device.capabilities) {
    if (typeof item === 'string') {
      if (item === capability) {
        return true;
      }
    } else if (item && typeof item === 'object' && 'capability' in item) {
      if (item.capability === capability) {
        return item.enabled !== false;
      }
    }
  }

  return false;
}

/**
 * Derives the canonical capability list for a given device type.
 * Ensures new devices strictly receive their hardware-mapped capabilities server-side.
 */
export function getCanonicalCapabilitiesForDeviceType(deviceType: DeviceType): string[] {
  switch (deviceType) {
    case DeviceType.SOIL_NODE:
      return [...SOIL_NODE_MONITORING_PARAMETERS];
    case DeviceType.WATER_QUALITY_NODE:
      return [...WATER_QUALITY_NODE_MONITORING_PARAMETERS];
    case DeviceType.WATER_TANK_NODE:
      return [...WATER_TANK_NODE_MONITORING_PARAMETERS, ...WATER_TANK_NODE_CONTROL_CAPABILITIES];
    default:
      return [];
  }
}

export enum DeviceAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}

export enum DeviceConnectionStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  STALE = 'STALE',
  UNKNOWN = 'UNKNOWN',
  INACTIVE = 'INACTIVE',
}

export const DeviceTypeSchema = z.nativeEnum(DeviceType);
export const DeviceAccountStatusSchema = z.nativeEnum(DeviceAccountStatus);
export const DeviceConnectionStatusSchema = z.nativeEnum(DeviceConnectionStatus);

export const DevicePermissionsDtoSchema = z.object({
  canView: z.boolean(),
  canControl: z.boolean(),
});

export type DevicePermissionsDto = z.infer<typeof DevicePermissionsDtoSchema>;

/**
 * Public/Safe Device DTO schema.
 * EXCLUDES: device secrets, provisioning tokens, API keys, passwords, private keys, hashes.
 */
export const PublicSafeDeviceDtoSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().min(1).max(150),
  siteId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  deviceType: DeviceTypeSchema,
  accountStatus: DeviceAccountStatusSchema,
  connectionStatus: DeviceConnectionStatusSchema,
  firmwareVersion: z.string().nullable(),
  hardwareRevision: z.string().nullable(),
  schemaVersion: z.string().nullable(),
  lastSeenAt: z.date().nullable(),
  lastMessageAt: z.date().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deactivatedAt: z.date().nullable(),
  capabilities: z.array(z.string()),
  permissions: DevicePermissionsDtoSchema.optional(),
});

export type PublicSafeDeviceDto = z.infer<typeof PublicSafeDeviceDtoSchema>;

/**
 * Validates canonical device identifier.
 * Unique, stable, machine-readable, untranslated, not derived from display label.
 */
export const CanonicalDeviceIdSchema = z
  .string()
  .min(3, 'deviceId must be at least 3 characters')
  .max(150, 'deviceId must not exceed 150 characters')
  .regex(
    /^[a-z0-9-_]+$/,
    'deviceId must contain only lowercase alphanumeric characters, hyphens, and underscores'
  );

/**
 * Input schema for creating a new device (Owner-only).
 * deviceId is optional on input (server-side auto-generated if omitted).
 */
export const CreateDeviceInputSchema = z.object({
  deviceId: CanonicalDeviceIdSchema.optional(),
  name: z.string().min(1, 'Nama perangkat wajib diisi').max(200),
  deviceType: NewDeviceTypeSchema,
  siteId: z.string().uuid().optional().nullable(),
  firmwareVersion: z.string().max(100).optional().nullable(),
  hardwareRevision: z.string().max(100).optional().nullable(),
  schemaVersion: z.string().max(30).optional().nullable(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional()
    .nullable(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional()
    .nullable(),
  capabilities: z.array(z.string()).optional(),
});

export type CreateDeviceInput = z.infer<typeof CreateDeviceInputSchema>;

/**
 * Input schema for updating an existing device (Owner-only).
 * Reject security-sensitive/read-only fields (deviceId, connectionStatus, lastSeenAt, etc.).
 */
export const UpdateDeviceInputSchema = z
  .object({
    name: z.string().min(1, 'Nama perangkat wajib diisi').max(200).optional(),
    deviceType: DeviceTypeSchema.optional(),
    accountStatus: DeviceAccountStatusSchema.optional(),
    siteId: z.string().uuid().nullable().optional(),
    firmwareVersion: z.string().max(100).nullable().optional(),
    hardwareRevision: z.string().max(100).nullable().optional(),
    schemaVersion: z.string().max(30).nullable().optional(),
    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .nullable()
      .optional(),
    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateDeviceInput = z.infer<typeof UpdateDeviceInputSchema>;

/**
 * Query schema for listing devices.
 */
export const DeviceQueryInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  siteId: z.string().uuid().optional(),
  deviceType: DeviceTypeSchema.optional(),
  connectionStatus: DeviceConnectionStatusSchema.optional(),
  accountStatus: DeviceAccountStatusSchema.optional(),
  search: z.string().optional(),
  sort: z.string().default('createdAt:desc'),
});

export type DeviceQueryInput = z.infer<typeof DeviceQueryInputSchema>;
