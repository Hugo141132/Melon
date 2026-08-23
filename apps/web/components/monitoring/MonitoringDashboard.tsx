'use client';

import React from 'react';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import {
  Sprout,
  Droplets,
  Gauge,
  Thermometer,
  Activity,
  AlertTriangle,
  RefreshCw,
  Clock,
  WifiOff,
  Database,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, formatDeviceDisplayName } from '@/lib/utils';

// Helper to format numeric values nicely or return placeholder
function formatMetricValue(val: number | null | undefined, decimals = 1, fallback = '-'): string {
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

// ─── Single Metric Item Display ───────────────────────────
interface MetricItemProps {
  label: string;
  value: string;
  unit?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  highlightColor?: string;
}

function MetricItem({ label, value, unit, sublabel, icon, highlightColor }: MetricItemProps) {
  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-4 border border-app-outline-variant/30 soft-elevation transition-all hover:border-app-primary/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-app-primary bg-app-primary/10',
              highlightColor
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[24px] leading-8 font-bold text-app-on-surface">{value}</span>
        {unit && (
          <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
            {unit}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-[11px] leading-4 text-app-on-surface-variant mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// ─── Skeleton Loading Cards ───────────────────────────────
function MonitoringSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" data-testid="monitoring-skeleton">
      {/* Device Header Skeleton */}
      <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/20 h-24" />
      {/* Cards Skeleton Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 h-32" />
        <div className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 h-32" />
        <div className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 h-32" />
        <div className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 h-32" />
      </div>
    </div>
  );
}

// ─── Soil Monitoring Section ──────────────────────────────
interface SoilSectionProps {
  data: {
    nitrogen: number | null;
    phosphorus: number | null;
    potassium: number | null;
    temperature: number | null;
    moisture: number | null;
    ph: number | null;
    ec: number | null;
    status: string | null;
  };
  recordedAt: string | null;
  isStale: boolean;
}

function SoilMonitoringSection({ data, recordedAt }: SoilSectionProps) {
  const tSoil = useTranslations('soil');
  const tCommon = useTranslations('common');

  return (
    <section className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-app-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
            <Sprout size={20} />
          </div>
          <div>
            <h3 className="text-[16px] leading-6 font-bold text-app-on-surface">
              {tSoil('soilMonitoringTitle')}
            </h3>
            <p className="text-[12px] leading-4 text-app-on-surface-variant">
              {tCommon('recordedAt', {
                time: formatTimestamp(recordedAt, tCommon('noDataAvailable')),
              })}
            </p>
          </div>
        </div>
        {data.status && (
          <span className="text-[12px] leading-4 font-semibold px-2.5 py-1 rounded-full bg-app-primary/10 text-app-primary">
            {data.status}
          </span>
        )}
      </div>

      {/* NPK Summary */}
      <div className="bg-app-surface-container-low/50 rounded-xl p-4 border border-app-outline-variant/20">
        <p className="text-[12px] font-semibold text-app-on-surface-variant mb-2">
          {tSoil('mainNutrients')}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-emerald-500/10">
            <span className="text-[11px] font-bold text-emerald-700 block">
              {tSoil('nitrogen')} (N)
            </span>
            <span className="text-[18px] font-bold text-app-on-surface">
              {formatMetricValue(data.nitrogen, 0)}
            </span>
            <span className="text-[10px] text-app-on-surface-variant block">mg/kg</span>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/10">
            <span className="text-[11px] font-bold text-amber-700 block">
              {tSoil('phosphorus')} (P)
            </span>
            <span className="text-[18px] font-bold text-app-on-surface">
              {formatMetricValue(data.phosphorus, 0)}
            </span>
            <span className="text-[10px] text-app-on-surface-variant block">mg/kg</span>
          </div>
          <div className="text-center p-2 rounded-lg bg-lime-500/10">
            <span className="text-[11px] font-bold text-lime-700 block">
              {tSoil('potassium')} (K)
            </span>
            <span className="text-[18px] font-bold text-app-on-surface">
              {formatMetricValue(data.potassium, 0)}
            </span>
            <span className="text-[10px] text-app-on-surface-variant block">mg/kg</span>
          </div>
        </div>
      </div>

      {/* Environmental & Chemical Soil Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricItem
          label={tSoil('temperature')}
          value={formatMetricValue(data.temperature, 1)}
          unit="°C"
          icon={<Thermometer size={16} />}
        />
        <MetricItem
          label={tSoil('moisture')}
          value={formatMetricValue(data.moisture, 1)}
          unit="%RH"
          icon={<Droplets size={16} />}
        />
        <MetricItem
          label={tSoil('ph')}
          value={formatMetricValue(data.ph, 2)}
          icon={<Activity size={16} />}
        />
        <MetricItem
          label={`${tSoil('ec')} (${tSoil('status')})`}
          value={data.ec !== null && data.ec !== undefined ? formatMetricValue(Math.round(data.ec * 1000), 0) : '-'}
          unit="µS/cm"
          icon={<Gauge size={16} />}
        />
      </div>
    </section>
  );
}

// ─── Water Quality Section ────────────────────────────────
interface WaterQualitySectionProps {
  data: {
    ph: number | null;
    tds: number | null;
    ec: number | null;
    status: string | null;
  };
  recordedAt: string | null;
}

function WaterQualitySection({ data, recordedAt }: WaterQualitySectionProps) {
  const tWater = useTranslations('water');
  const tCommon = useTranslations('common');

  return (
    <section className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-app-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
            <Droplets size={20} />
          </div>
          <div>
            <h3 className="text-[16px] leading-6 font-bold text-app-on-surface">
              {tWater('irrigationWaterQuality')}
            </h3>
            <p className="text-[12px] leading-4 text-app-on-surface-variant">
              {tCommon('recordedAt', {
                time: formatTimestamp(recordedAt, tCommon('noDataAvailable')),
              })}
            </p>
          </div>
        </div>
        {data.status && (
          <span className="text-[12px] leading-4 font-semibold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-700">
            {data.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricItem
          label={tWater('ph')}
          value={formatMetricValue(data.ph, 2)}
          icon={<Activity size={16} />}
        />
        <MetricItem
          label={tWater('tds')}
          value={formatMetricValue(data.tds, 0)}
          unit="ppm"
          icon={<Sliders size={16} />}
        />
        <MetricItem
          label={tWater('ec')}
          value={data.ec !== null && data.ec !== undefined ? formatMetricValue(Math.round(data.ec * 1000), 0) : '-'}
          unit="µS/cm"
          icon={<Gauge size={16} />}
        />
      </div>
    </section>
  );
}

// ─── Water Tank Section (No Reservoir Terminology) ────────
interface WaterTankSectionProps {
  data: {
    tankVolume: number | null;
    flowRate: number | null;
    status: string | null;
  };
  recordedAt: string | null;
}

function WaterTankSection({ data, recordedAt }: WaterTankSectionProps) {
  const tWater = useTranslations('water');
  const tCommon = useTranslations('common');

  return (
    <section className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-app-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-[16px] leading-6 font-bold text-app-on-surface">
              {tWater('waterTankMonitoringTitle')}
            </h3>
            <p className="text-[12px] leading-4 text-app-on-surface-variant">
              {tCommon('recordedAt', {
                time: formatTimestamp(recordedAt, tCommon('noDataAvailable')),
              })}
            </p>
          </div>
        </div>
        {data.status && (
          <span className="text-[12px] leading-4 font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700">
            {data.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricItem
          label={tWater('tankVolume')}
          value={formatMetricValue(data.tankVolume, 1)}
          unit="L"
          icon={<Database size={16} />}
        />
        <MetricItem
          label={tWater('flowRate')}
          value={formatMetricValue(data.flowRate, 1)}
          unit="m³/h"
          icon={<Activity size={16} />}
        />
      </div>
    </section>
  );
}

// ─── Main Monitoring Dashboard Component ──────────────────
export default function MonitoringDashboard() {
  const tDashboard = useTranslations('dashboard');
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
      <div className="bg-app-surface-container-lowest rounded-2xl p-8 text-center border border-app-outline-variant/30 soft-elevation-lg my-4">
        <div className="w-12 h-12 rounded-full bg-app-primary/10 flex items-center justify-center text-app-primary mx-auto mb-3">
          <Sprout size={24} />
        </div>
        <h3 className="text-[18px] font-bold text-app-on-surface mb-1">
          {tDevices('noDeviceSelectedTitle')}
        </h3>
        <p className="text-[14px] text-app-on-surface-variant max-w-sm mx-auto">
          {tDevices('noDeviceSelectedDesc')}
        </p>
      </div>
    );
  }

  // 2. Loading State
  if (isLoading) {
    return <MonitoringSkeleton />;
  }

  // 3. Error State
  if (error) {
    return (
      <div className="bg-app-error/5 border border-app-error/30 rounded-2xl p-6 text-center soft-elevation my-4 space-y-3">
        <div className="w-12 h-12 rounded-full bg-app-error/10 flex items-center justify-center text-app-error mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-[16px] font-bold text-app-error">
          {tDashboard('loadMonitoringFailed')}
        </h3>
        <p className="text-[13px] text-app-on-surface-variant max-w-md mx-auto">{error}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 bg-app-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-app-primary/90 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={isRevalidating ? 'animate-spin' : ''} />
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  // Determine sub-data availability
  const hasSoilData = snapshot?.soil && snapshot.soil.data;
  const hasWaterQualityData =
    snapshot?.water &&
    snapshot.water.data &&
    (snapshot.water.data.ph !== null ||
      snapshot.water.data.tds !== null ||
      snapshot.water.data.ec !== null);
  const hasWaterTankData =
    snapshot?.water &&
    snapshot.water.data &&
    (snapshot.water.data.tankVolume !== null || snapshot.water.data.flowRate !== null);

  const hasAnyData = hasSoilData || hasWaterQualityData || hasWaterTankData;

  // Status Badge Colors & Labels
  const isOnline = connectionStatus === 'ONLINE';
  const isOffline = connectionStatus === 'OFFLINE';
  const isStaleStatus = connectionStatus === 'STALE' || isStale;

  return (
    <div className="space-y-5 animate-fade-in" data-testid="monitoring-dashboard">
      {/* ── Device Status & Freshness Banner ── */}
      <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-wrap items-center justify-between gap-4">
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
            <p className="text-[12px] text-app-on-surface-variant flex items-center gap-1 mt-0.5">
              <Clock size={13} />
              {tDevices('lastSeen')}:{' '}
              {formatTimestamp(
                snapshot?.lastSeenAt || selectedDevice?.lastSeenAt,
                tCommon('noDataAvailable')
              )}
            </p>
          </div>
        </div>

        {/* Refresh & Connection Badges */}
        <div className="flex items-center gap-2">
          {isOffline && (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded-full bg-rose-500/10 text-rose-700">
              <WifiOff size={14} /> {tDevices('offlineStatus')}
            </span>
          )}
          {isStaleStatus && !isOffline && (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-700">
              <AlertTriangle size={14} /> {tDevices('staleStatus')}
            </span>
          )}
          {isOnline && !isStaleStatus && (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 size={14} /> {tDevices('onlineStatus')}
            </span>
          )}

          <button
            onClick={() => refetch()}
            disabled={isRevalidating}
            title={tCommon('refresh')}
            className="p-2 rounded-xl border border-app-outline-variant/30 text-app-on-surface-variant hover:bg-app-surface-container-low transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={isRevalidating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Stale Warning Alert ── */}
      {isStaleStatus && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
          <p className="text-[13px] leading-5 text-amber-800 font-medium">
            {tDashboard('staleWarningNotice')}
          </p>
        </div>
      )}

      {/* ── Empty State (No Telemetry Data) ── */}
      {!hasAnyData && (
        <div className="bg-app-surface-container-lowest rounded-2xl p-8 text-center border border-app-outline-variant/30 soft-elevation my-4">
          <div className="w-12 h-12 rounded-full bg-app-surface-container flex items-center justify-center text-app-on-surface-variant mx-auto mb-3">
            <Database size={24} />
          </div>
          <h3 className="text-[16px] font-bold text-app-on-surface mb-1">
            {tDashboard('noMonitoringData')}
          </h3>
          <p className="text-[13px] text-app-on-surface-variant max-w-sm mx-auto">
            {tDashboard('deviceNeverSentData', { deviceName: selectedDevice?.deviceName })}
          </p>
        </div>
      )}

      {/* ── Render Sections Based on Capability / Returned Data ── */}

      {/* 1. SOIL TELEMETRY */}
      {hasSoilData && (
        <SoilMonitoringSection
          data={snapshot!.soil!.data}
          recordedAt={snapshot!.soil!.recordedAt}
          isStale={snapshot!.soil!.isStale}
        />
      )}

      {/* 2. WATER QUALITY */}
      {hasWaterQualityData && (
        <WaterQualitySection
          data={snapshot!.water!.data}
          recordedAt={snapshot!.water!.recordedAt}
        />
      )}

      {/* 3. WATER TANK */}
      {hasWaterTankData && (
        <WaterTankSection data={snapshot!.water!.data} recordedAt={snapshot!.water!.recordedAt} />
      )}
    </div>
  );
}
