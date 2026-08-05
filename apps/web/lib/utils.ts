import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeviceDisplayName(
  device?: { deviceName?: string; deviceType?: string; deviceId?: string } | null
): string {
  if (!device) return 'Perangkat';
  const name = device.deviceName || '';

  // If deviceName is missing, matches raw deviceId, or follows raw node ID pattern (e.g. water-tank-node-3uufzi)
  const isRawId =
    !name ||
    (device.deviceId && name === device.deviceId) ||
    /^(soil|water|water-quality|water-tank)-node-[a-z0-9_-]+$/i.test(name) ||
    /^[a-z0-9_-]+-[a-z0-9]{5,}$/i.test(name);

  if (isRawId) {
    switch (device.deviceType) {
      case 'SOIL_NODE':
        return 'Node Sensor Tanah';
      case 'WATER_QUALITY_NODE':
        return 'Node Kualitas Air';
      case 'WATER_TANK_NODE':
        return 'Node Tangki Air';
      default:
        return 'Node Perangkat';
    }
  }
  return name;
}
