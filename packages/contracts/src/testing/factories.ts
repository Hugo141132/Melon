import { UserRole, AccountStatus } from '../enums';
import { PublicSafeUserDto } from '../user';
import {
  PublicSafeDeviceDto,
  DeviceType,
  DeviceAccountStatus,
  DeviceConnectionStatus,
} from '../device';
import { SoilTelemetryPayload } from '../telemetry';

export interface MockSessionDto {
  userId: string;
  email: string;
  fullName: string;
  username?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface MockAlertDto {
  id: string;
  deviceId: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
  acknowledgedAt?: string | null;
  acknowledgedByUserId?: string | null;
}

export interface MockFaucetCommandDto {
  id: string;
  idempotencyKey: string;
  deviceId: string;
  requestedByUserId: string;
  phase: 'PHASE_1' | 'PHASE_2' | 'PHASE_3';
  targetVolumeMl: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function buildUserFactory(overrides?: Partial<PublicSafeUserDto>): PublicSafeUserDto {
  const id =
    overrides?.id ??
    `00000000-0000-4000-8000-${Math.random().toString(16).substring(2, 14).padStart(12, '0')}`;
  return {
    id,
    email: overrides?.email ?? `${id}@kebunmelon.local`,
    fullName: overrides?.fullName ?? 'Test User',
    username: overrides?.username ?? `user_${id.substring(0, 8)}`,
    accountStatus: overrides?.accountStatus ?? AccountStatus.ACTIVE,
    emailVerifiedAt: overrides?.emailVerifiedAt ?? null,
    lastLoginAt: overrides?.lastLoginAt ?? null,
    suspendedAt: overrides?.suspendedAt ?? null,
    deactivatedAt: overrides?.deactivatedAt ?? null,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
    activeRoles: overrides?.activeRoles ?? [UserRole.ADMIN],
  };
}

export function buildSessionFactory(overrides?: Partial<MockSessionDto>): MockSessionDto {
  const userId = overrides?.userId ?? `user-${Math.random().toString(36).substring(2, 9)}`;
  return {
    userId,
    email: overrides?.email ?? `${userId}@kebunmelon.local`,
    fullName: overrides?.fullName ?? 'Test Session User',
    username: overrides?.username ?? `session_${userId}`,
    role: overrides?.role ?? UserRole.ADMIN,
    accountStatus: overrides?.accountStatus ?? AccountStatus.ACTIVE,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
  };
}

export function buildDeviceFactory(overrides?: Partial<PublicSafeDeviceDto>): PublicSafeDeviceDto {
  const id =
    overrides?.id ??
    `00000000-0000-4000-8000-${Math.random().toString(36).substring(2, 14).padStart(12, '0')}`;
  const deviceId = overrides?.deviceId ?? `device-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    deviceId,
    name: overrides?.name ?? `Test Device ${deviceId}`,
    deviceType: overrides?.deviceType ?? DeviceType.SOIL_NODE,
    siteId: overrides?.siteId ?? null,
    accountStatus: overrides?.accountStatus ?? DeviceAccountStatus.ACTIVE,
    connectionStatus: overrides?.connectionStatus ?? DeviceConnectionStatus.ONLINE,
    capabilities: overrides?.capabilities ?? ['SOIL_NITROGEN', 'SOIL_PHOSPHORUS', 'SOIL_POTASSIUM'],
    firmwareVersion: overrides?.firmwareVersion ?? 'v1.0.0',
    hardwareRevision: overrides?.hardwareRevision ?? 'ESP32-DEVKIT-V1',
    schemaVersion: overrides?.schemaVersion ?? '1.0',
    lastSeenAt: overrides?.lastSeenAt ?? new Date(),
    lastMessageAt: overrides?.lastMessageAt ?? new Date(),
    latitude: overrides?.latitude ?? -6.2,
    longitude: overrides?.longitude ?? 106.816666,
    permissions: overrides?.permissions ?? { canView: true, canControl: false },
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
    deactivatedAt: overrides?.deactivatedAt ?? null,
  };
}

export function buildSoilTelemetryPayloadFactory(
  overrides?: Partial<SoilTelemetryPayload>
): SoilTelemetryPayload {
  const messageId = overrides?.messageId ?? `msg-${Math.random().toString(36).substring(2, 9)}`;
  const deviceId = overrides?.deviceId ?? `esp32-soil-01`;
  return {
    schemaVersion: overrides?.schemaVersion ?? '1.0',
    messageId,
    deviceId,
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
    sequence: overrides?.sequence ?? 1,
    data: {
      nitrogen: overrides?.data?.nitrogen ?? 45,
      phosphorus: overrides?.data?.phosphorus ?? 30,
      potassium: overrides?.data?.potassium ?? 120,
      temperature: overrides?.data?.temperature ?? 26.5,
      moisture: overrides?.data?.moisture ?? 42.0,
      ph: overrides?.data?.ph ?? 6.5,
      ec: overrides?.data?.ec ?? 1.2,
      status: overrides?.data?.status ?? null,
    },
  };
}

export function buildAlertFactory(overrides?: Partial<MockAlertDto>): MockAlertDto {
  const id = overrides?.id ?? `alert-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    deviceId: overrides?.deviceId ?? 'device-esp32-001',
    alertType: overrides?.alertType ?? 'DEVICE_OFFLINE',
    severity: overrides?.severity ?? 'WARNING',
    message: overrides?.message ?? 'Device went offline',
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    acknowledgedAt: overrides?.acknowledgedAt ?? null,
    acknowledgedByUserId: overrides?.acknowledgedByUserId ?? null,
  };
}

export function buildFaucetCommandFactory(
  overrides?: Partial<MockFaucetCommandDto>
): MockFaucetCommandDto {
  const id = overrides?.id ?? `cmd-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    idempotencyKey: overrides?.idempotencyKey ?? `idempotency-${id}`,
    deviceId: overrides?.deviceId ?? 'device-esp32-001',
    requestedByUserId: overrides?.requestedByUserId ?? 'user-owner-001',
    phase: overrides?.phase ?? 'PHASE_1',
    targetVolumeMl: overrides?.targetVolumeMl ?? 300,
    status: overrides?.status ?? 'QUEUED',
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}
