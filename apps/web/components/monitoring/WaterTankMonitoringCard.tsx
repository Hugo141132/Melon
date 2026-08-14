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
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return fallbackText;
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return fallbackText;
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

  // 2. Loading State (Skeleton)
  if (isLoading) {
    return (
      <div
        className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg space-y-4 animate-pulse"
        data-testid="water-tank-skeleton"
      >
        <div className="h-6 bg-app-surface-container rounded w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-app-surface-container rounded-xl" />
          <div className="h-24 bg-app-surface-container rounded-xl" />
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
  const volumeVal = waterData?.tankVolume;
  const flowVal = waterData?.flowRate;
  const isVolumeNull = volumeVal === null || volumeVal === undefined;
  const isFlowNull = flowVal === null || flowVal === undefined;

  const isOnline = connectionStatus === 'ONLINE';
  const isOffline = connectionStatus === 'OFFLINE';
  const isStaleStatus = connectionStatus === 'STALE' || isStale;

  // Max capacity calculation for visual bar fill
  const maxCapacity = 600;
  const volumePercent = !isVolumeNull
    ? Math.min(100, Math.max(0, (volumeVal / maxCapacity) * 100))
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
                {formatDeviceDisplayName(selectedDevice)}
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

      {/* 2-col Original Metric Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
        {/* Tank Volume Card (Exact Original UI) */}
        <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
              {tWater('tankVolume')}
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-app-on-surface">
                {formatMetricValue(volumeVal, 1)}
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
            <div className="h-2 w-full rounded-full bg-app-surface-container relative overflow-hidden">
              <div
                className="absolute top-0 left-0 bottom-0 bg-app-primary rounded-full transition-all duration-700"
                style={{ width: `${volumePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-bold text-app-on-surface-variant">0L</span>
              <span className="text-[10px] font-bold text-app-on-surface-variant">600L</span>
            </div>
          </div>
        </div>

        {/* Flow Rate Card (Exact Original UI) */}
        <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
              {tWater('flowRate')}
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-app-on-surface">
                {formatMetricValue(flowVal, 1)}
              </span>
              <span className="text-[12px] text-app-on-surface-variant">m³/h</span>
            </div>
            {isFlowNull && (
              <p className="text-[11px] text-app-on-surface-variant/70 mt-0.5 font-medium">
                {tCommon('noDataAvailable')}
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1 text-app-primary">
            <Waves size={14} />
            <span className="text-[12px] font-semibold">
              {waterData?.status || tWater('smoothFlow')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WaterTankMonitoringCard;
