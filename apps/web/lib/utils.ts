import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeviceDisplayName(
  device?: { deviceName?: string; deviceType?: string; deviceId?: string } | null,
  localeOrResolver?: string | ((key: string) => string)
): string {
  let locale = 'id';
  let resolver: ((key: string) => string) | null = null;

  if (typeof localeOrResolver === 'function') {
    resolver = localeOrResolver;
  } else if (
    typeof localeOrResolver === 'string' &&
    (localeOrResolver === 'en' || localeOrResolver === 'id')
  ) {
    locale = localeOrResolver;
  } else if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    if (match && (match[1] === 'en' || match[1] === 'id')) {
      locale = match[1];
    }
  }

  if (!device) {
    if (resolver) return resolver('deviceFallback');
    return locale === 'en' ? 'Device' : 'Perangkat';
  }

  const name = (device.deviceName || '').trim();

  // Known system default labels in Indonesian & English
  const KNOWN_DEFAULT_LABELS = [
    'Node Sensor Tanah',
    'Soil Sensor Node',
    'Soil Node',
    'Sensor Tanah',
    'Node Kualitas Air',
    'Water Quality Node',
    'Kualitas Air',
    'Node Tangki Air',
    'Water Tank Node',
    'Tangki Air',
    'Node Perangkat',
    'Device Node',
    'Perangkat',
    'Device',
  ];

  // If deviceName is missing, matches raw deviceId, follows raw node ID pattern, or matches known system default label
  const isDefaultName =
    !name ||
    (device.deviceId && name === device.deviceId) ||
    /^(soil|water|water-quality|water-tank)-node-[a-z0-9_-]+$/i.test(name) ||
    /^[a-z0-9_-]+-[a-z0-9]{5,}$/i.test(name) ||
    KNOWN_DEFAULT_LABELS.includes(name);

  if (isDefaultName) {
    const dType =
      device.deviceType ||
      (name.toLowerCase().includes('soil')
        ? 'SOIL_NODE'
        : name.toLowerCase().includes('tank')
          ? 'WATER_TANK_NODE'
          : name.toLowerCase().includes('water')
            ? 'WATER_QUALITY_NODE'
            : '');

    switch (dType) {
      case 'SOIL_NODE':
        if (resolver) return resolver('soilNodeDefault');
        return locale === 'en' ? 'Soil Sensor Node' : 'Node Sensor Tanah';
      case 'WATER_QUALITY_NODE':
        if (resolver) return resolver('waterQualityNodeDefault');
        return locale === 'en' ? 'Water Quality Node' : 'Node Kualitas Air';
      case 'WATER_TANK_NODE':
        if (resolver) return resolver('waterTankNodeDefault');
        return locale === 'en' ? 'Water Tank Node' : 'Node Tangki Air';
      default:
        if (resolver) return resolver('genericNodeDefault');
        return locale === 'en' ? 'Device Node' : 'Node Perangkat';
    }
  }

  return name;
}

export type NormalizedConnectionStatus = 'CONNECTED' | 'DISCONNECTED';

/**
 * Normalizes device connection status for user-facing presentation.
 * Per repository requirements, users only see two connection types:
 * - Connected: for ONLINE / active device connection.
 * - Disconnected: for OFFLINE, STALE, missing heartbeat, or unavailable device states.
 * Internal backend and device telemetry freshness evaluation logic remains intact.
 */
export function normalizeConnectionStatus(status?: string | null): NormalizedConnectionStatus {
  if (status === 'ONLINE') {
    return 'CONNECTED';
  }
  return 'DISCONNECTED';
}

/**
 * Returns localized presentation label for device connection status ('Connected' | 'Disconnected').
 */
export function getConnectionStatusLabel(
  status: string | null | undefined,
  resolver: (key: string) => string
): string {
  const normalized = normalizeConnectionStatus(status);
  return normalized === 'CONNECTED' ? resolver('connected') : resolver('disconnected');
}

/**
 * Returns consistent semantic dot indicator class for normalized connection status.
 */
export function getConnectionStatusDotColor(status?: string | null): string {
  const normalized = normalizeConnectionStatus(status);
  if (normalized === 'CONNECTED') {
    return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
  }
  return 'bg-rose-500';
}
