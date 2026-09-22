'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TopAppBar from '@/components/navigation/TopAppBar';
import { ShieldAlert, ArrowLeft, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDeviceDisplayName } from '@/lib/utils';

interface DeviceAccessForbiddenProps {
  deviceId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
}

export default function DeviceAccessForbidden({
  deviceId,
  deviceName,
  deviceType,
}: DeviceAccessForbiddenProps) {
  const tDevices = useTranslations('devices');
  const pathname = usePathname();

  // Resolve domain-specific fallback device type from current route if not provided
  const resolvedType =
    deviceType ||
    (pathname === '/soil'
      ? 'SOIL_NODE'
      : pathname === '/water'
        ? 'WATER_QUALITY_NODE'
        : pathname === '/controls'
          ? 'WATER_TANK_NODE'
          : undefined);

  // Check if deviceId is a raw database UUID
  const isUuid =
    typeof deviceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId.trim());

  // Never expose raw database UUID in the UI; resolve human-readable display label
  const rawCandidateName =
    deviceName &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceName.trim())
      ? deviceName
      : !isUuid
        ? deviceId
        : null;

  const displayLabel = formatDeviceDisplayName(
    {
      deviceName: rawCandidateName || undefined,
      deviceType: resolvedType,
      deviceId: !isUuid ? deviceId || undefined : undefined,
    },
    tDevices
  );

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showDeviceSelector={false} />

      <main className="pt-24 px-4 max-w-xl mx-auto text-center animate-fade-in">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-8 rounded-2xl soft-elevation-lg space-y-4">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <ShieldAlert size={32} />
          </div>

          <h1 className="text-[20px] font-bold text-red-900 dark:text-red-300">
            {tDevices('deviceAccessRevokedTitle')}
          </h1>

          <p className="text-[14px] leading-relaxed text-red-700 dark:text-red-400">
            {tDevices('deviceAccessRevokedDesc')}
          </p>

          {displayLabel && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100/70 dark:bg-red-900/50 rounded-lg text-xs text-red-800 dark:text-red-300">
              <Cpu size={14} />
              <span className="font-semibold">{displayLabel}</span>
            </div>
          )}

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sensor"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-[14px] font-semibold transition-colors shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>{tDevices('backToSensorOverview')}</span>
            </Link>

            <Link
              href="/devices"
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-white dark:bg-app-surface-container-low hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 rounded-xl text-[14px] font-medium transition-colors"
            >
              {tDevices('viewMyDevices')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
