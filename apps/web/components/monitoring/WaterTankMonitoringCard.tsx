'use client';

import React from 'react';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import {
  Database,
  AlertTriangle,
  RefreshCw,
  Clock,
  WifiOff,
  CheckCircle2,
  Waves,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, formatDeviceDisplayName } from '@/lib/utils';
import { WATER_TANK_MAX_CAPACITY } from '@/lib/constants';

export { WATER_TANK_MAX_CAPACITY };

// Helper to format numeric values nicely or return placeholder
function formatMetricValue(val: number | null | undefined, decimals = 1, fallback = '—'): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return Number.isInteger(val) ? val.toString() : val.toFixed(decimals);
}

// Format timestamp cleanly into Indonesian format
function formatTimestamp(
  isoString: string | null | undefined,
  fallbackText = 'Belum ada data'
): string {
  if (!isoString) return fallbackText;
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function WaterTankMonitoringCard() {
  const tWater = useTranslations('water');
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');

  const { selectedDevice, isLoading: isDeviceLoading } = useDeviceContext();
  const {
    snapshot,
    isLoading: isMonitoringLoading,
    isRevalidating,
    isStale,
    connectionStatus,
    error,
    refetch,
  } = useLatestMonitoring();

  const isLoading = isDeviceLoading || isMonitoringLoading;

  // 1. No device selected
  if (!selectedDevice && !isLoading) {
    return (
      <div className="bg-app-surface-container-lowest rounded-2xl p-6 text-center border border-app-outline-variant/30 soft-elevation-lg my-2">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 mx-auto mb-2">
          <Database size={20} />
        </div>
        <h3 className="text-[16px] font-bold text-app-on-surface mb-1">
          {tDevices('noDeviceSelected')}
        </h3>
        <p className="text-[13px] text-app-on-surface-variant max-w-sm mx-auto">
          {tWater('selectTankDeviceDesc')}
        </p>
      </div>
    );
  }

  // 2. Loading State (Structural Skeleton matching loaded layout)
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="water-tank-skeleton">
        {/* Device Header Banner Skeleton */}
        <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-wrap items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-app-surface-container flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {selectedDevice ? (
                  <h2 className="text-[16px] font-bold text-app-on-surface">
                    {formatDeviceDisplayName(selectedDevice, tDevices)}
                  </h2>
                ) : (
                  <div className="h-5 w-36 bg-app-surface-container rounded" />
                )}
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-app-surface-container text-app-on-surface-variant">
                  {selectedDevice?.deviceType || 'WATER_TANK_NODE'}
                </span>
              </div>
              <div className="h-3 w-28 bg-app-surface-container rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-app-surface-container rounded-full" />
            <div className="w-8 h-8 rounded-xl border border-app-outline-variant/30 bg-app-surface-container/40" />
          </div>
        </div>

        {/* Metric Card Grid Skeleton */}
        <div className="grid grid-cols-1 gap-4">
          {/* Tank Volume Card Skeleton */}
          <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between animate-pulse">
            <div>
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                {tWater('tankVolume')}
              </h3>
              <div className="flex items-baseline gap-1">
                <div className="h-9 w-20 bg-app-surface-container rounded my-0.5" />
                <span className="text-[12px] text-app-on-surface-variant">L</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-app-surface-container" />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-bold text-app-on-surface-variant">0 L</span>
                <span className="text-[10px] font-bold text-app-on-surface-variant">2200 L</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Error State
  if (error) {
    return (
      <div
        className="bg-app-error/5 border border-app-error/30 rounded-2xl p-5 text-center soft-elevation my-2 space-y-2"
        data-testid="water-tank-error"
      >
        <div className="w-10 h-10 rounded-full bg-app-error/10 flex items-center justify-center text-app-error mx-auto">
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-[15px] font-bold text-app-error">
          {tWater('waterTankDataLoadFailed')}
        </h3>
        <p className="text-[12px] text-app-on-surface-variant max-w-md mx-auto">{error}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 bg-app-primary text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-xl hover:bg-app-primary/90 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={isRevalidating ? 'animate-spin' : ''} />
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  const waterData = snapshot?.water?.data;
  const rawVolumeVal = waterData?.tankVolume;

  const isOnline = connectionStatus === 'ONLINE';
  const isOffline = connectionStatus === 'OFFLINE';
  const isStaleStatus = connectionStatus === 'STALE' || isStale;

  // Requirement: ONLINE shows current tank volume; STALE/OFFLINE hides tank volume value and shows placeholder ('- L')
  const shouldShowVolume = isOnline && !isStaleStatus && !isOffline;
  const displayVolume = shouldShowVolume ? rawVolumeVal : null;
  const isVolumeNull = displayVolume === null || displayVolume === undefined;

  // Max capacity calculation for visual bar fill (0 - 2200 L)
  const maxCapacity = WATER_TANK_MAX_CAPACITY;
  const volumePercent = !isVolumeNull
    ? Math.min(100, Math.max(0, (displayVolume / maxCapacity) * 100))
    : 0;

  return (
    <div className="space-y-4" data-testid="water-tank-monitoring-card">
      {/* Device Header Banner */}
      <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-3 h-3 rounded-full flex-shrink-0',
              isOnline && 'bg-emerald-500 animate-pulse',
              isOffline && 'bg-rose-500',
              isStaleStatus && 'bg-amber-500'
            )}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-app-on-surface">
                {formatDeviceDisplayName(selectedDevice, tDevices)}
              </h2>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-app-surface-container text-app-on-surface-variant">
                {selectedDevice?.deviceType}
              </span>
            </div>
            <p className="text-[11px] text-app-on-surface-variant flex items-center gap-1 mt-0.5">
              <Clock size={12} />
              {tDevices('lastSeen')}:{' '}
              {formatTimestamp(
                snapshot?.lastSeenAt || selectedDevice?.lastSeenAt,
                tCommon('noDataAvailable')
              )}
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {isOffline && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700">
              <WifiOff size={13} /> {tDevices('offlineStatus')}
            </span>
          )}
          {isStaleStatus && !isOffline && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700">
              <AlertTriangle size={13} /> {tDevices('staleStatus')}
            </span>
          )}
          {isOnline && !isStaleStatus && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 size={13} /> {tDevices('onlineStatus')}
            </span>
          )}

          <button
            onClick={() => refetch()}
            disabled={isRevalidating}
            title={tCommon('refresh')}
            className="p-1.5 rounded-xl border border-app-outline-variant/30 text-app-on-surface-variant hover:bg-app-surface-container-low transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isRevalidating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stale Warning Banner */}
      {isStaleStatus && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-2.5">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-[12px] leading-4 text-amber-800 font-medium">
            {tWater('staleOfflineNotice')}
          </p>
        </div>
      )}

      {/* Metric Card Grid */}
      <div className="grid grid-cols-1 gap-4 animate-fade-in">
        {/* Tank Volume Card */}
        <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant">
                {tWater('tankVolume')}
              </h3>
              {waterData?.status && shouldShowVolume && (
                <div className="flex items-center gap-1 text-app-primary">
                  <Waves size={14} />
                  <span className="text-[12px] font-semibold">{waterData.status}</span>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-app-on-surface">
                {formatMetricValue(displayVolume, 2)}
              </span>
              <span className="text-[12px] text-app-on-surface-variant">L</span>
            </div>
            {isVolumeNull && (
              <p className="text-[11px] text-app-on-surface-variant/70 mt-0.5 font-medium">
                {tCommon('noDataAvailable')}
              </p>
            )}
          </div>
          <div className="mt-4">
            <div
              role="progressbar"
              aria-label={tWater('tankVolume')}
              aria-valuemin={0}
              aria-valuemax={maxCapacity}
              aria-valuenow={
                !isVolumeNull ? Math.min(maxCapacity, Math.max(0, displayVolume)) : undefined
              }
              className="h-2 w-full rounded-full bg-app-surface-container relative overflow-hidden"
            >
              <div
                data-testid="tank-volume-progress-bar"
                className="absolute top-0 left-0 bottom-0 bg-app-primary rounded-full transition-all duration-700"
                style={{ width: `${volumePercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-[11px] text-app-on-surface-variant font-medium">
              <span>0 L</span>
              <span>{maxCapacity} L</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WaterTankMonitoringCard;
