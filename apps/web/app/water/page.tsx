'use client';

import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';
import { CheckCircle, TrendingUp, Cpu, Clock, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const WaterNutrientChart = dynamic(() => import('@/components/charts/WaterNutrientChart'), {
  ssr: false,
});

// Format timestamp into Indonesian format
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

function ECGauge({ value }: { value: number | null | undefined }) {
  const tWater = useTranslations('water');
  const hasValue = value !== null && value !== undefined && !isNaN(value);
  // Explicit presentation conversion from source unit (mS/cm) to display unit (µS/cm)
  const displayVal = hasValue ? Math.round(value * 1000) : '-';
  const numDisplayVal = hasValue ? Math.round(value * 1000) : 0;
  const maxEC = 4000;
  const angle = hasValue ? -135 + (Math.min(numDisplayVal, maxEC) / maxEC) * 270 : -135;

  return (
    <div className="flex flex-col items-center mb-2">
      <div className="relative" style={{ width: 180, height: 90, overflow: 'hidden' }}>
        {/* Track */}
        <div className="ec-gauge-track absolute top-0 left-0" />
        {/* Fill */}
        <div className="ec-gauge-fill" style={{ transform: `rotate(${angle - 90}deg)` }} />
        {/* Value overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-[28px] leading-9 font-bold text-app-primary">{displayVal}</span>
          <span className="text-[12px] leading-4 text-app-on-surface-variant">µS/cm</span>
        </div>
      </div>
      {hasValue && (
        <div className="flex items-center gap-2 bg-app-primary/10 px-4 py-1.5 rounded-full mt-2">
          <CheckCircle size={16} className="text-app-primary" />
          <span className="text-[14px] font-semibold text-app-primary">
            {tWater('statusStable')}
          </span>
        </div>
      )}
    </div>
  );
}

// pH bar for Water Quality Node
function PHBar({ value }: { value: number | null | undefined }) {
  const hasValue = value !== null && value !== undefined && !isNaN(value);
  const pct = hasValue ? Math.max(0, Math.min(100, ((value - 1) / 13) * 100)) : 50;

  return (
    <div className="mt-4">
      <div className="h-2 w-full rounded-full ph-gradient relative overflow-hidden">
        {hasValue && (
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-white shadow-sm rounded-full border border-app-outline/20"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[10px] font-bold">1</span>
        <span className="text-[10px] font-bold text-app-primary">7</span>
        <span className="text-[10px] font-bold">14</span>
      </div>
    </div>
  );
}

export default function WaterPage() {
  const tWater = useTranslations('water');
  const tSoil = useTranslations('soil');
  const tCommon = useTranslations('common');
  const { selectedDevice } = useDeviceContext();
  const { snapshot, isStale } = useLatestMonitoring();

  const deviceType = selectedDevice?.deviceType;

  const isTankNode = deviceType === 'WATER_TANK_NODE';
  const isSoilNode = deviceType === 'SOIL_NODE';
  const isQualityNode = !isTankNode && !isSoilNode;

  const activeDeviceId = isQualityNode
    ? selectedDevice?.id || selectedDevice?.deviceId || null
    : null;

  const {
    preset,
    setPreset,
    selectedMetric,
    setSelectedMetric,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    data: historyData,
    loading: historyLoading,
    error: historyError,
    dateRangeError,
  } = useHistoricalMonitoring({
    deviceId: activeDeviceId,
    domain: 'water',
    initialMetric: 'ec',
  });

  const waterData = snapshot?.water?.data;
  const recordedAt = snapshot?.water?.recordedAt;
  const lastSeenAt = snapshot?.lastSeenAt || selectedDevice?.lastSeenAt;

  // Stale evaluation: top-level hook isStale, top-level connectionStatus === 'STALE', or domain isStale
  const isTelemetryStale = Boolean(
    isStale || snapshot?.water?.isStale || snapshot?.connectionStatus === 'STALE'
  );

  const phVal = !isTelemetryStale ? (waterData?.ph ?? null) : null;
  const tdsVal = !isTelemetryStale ? (waterData?.tds ?? null) : null;
  const ecVal = !isTelemetryStale ? (waterData?.ec ?? null) : null;
  const hasTelemetry = Boolean(
    !isTelemetryStale && waterData && (phVal !== null || tdsVal !== null || ecVal !== null)
  );
  const statusLabel = waterData?.status || tCommon('optimal');

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto space-y-5">
        {(isSoilNode || isTankNode) && (
          <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center text-center animate-fade-in space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-app-on-surface">
                {isSoilNode ? tWater('activeSoilDeviceTitle') : tWater('activeTankDeviceTitle')}
              </h3>
              <p className="text-[12px] text-app-on-surface-variant mt-1 max-w-sm">
                {isSoilNode
                  ? tWater('soilDeviceNotice', { deviceName: selectedDevice?.deviceName })
                  : tWater('tankDeviceNotice', { deviceName: selectedDevice?.deviceName })}
              </p>
            </div>
          </section>
        )}

        {isQualityNode && (
          <>
            {/* Status Overview & Real-Time Header */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isTelemetryStale
                        ? 'bg-amber-500'
                        : hasTelemetry
                          ? 'bg-app-primary animate-pulse'
                          : 'bg-gray-400'
                    }`}
                  />
                  <span
                    className={`text-[14px] font-semibold ${
                      isTelemetryStale
                        ? 'text-amber-700 dark:text-amber-400'
                        : hasTelemetry
                          ? 'text-app-primary'
                          : 'text-app-on-surface-variant'
                    }`}
                  >
                    {isTelemetryStale
                      ? tCommon('stale')
                      : hasTelemetry
                        ? tWater('statusLabel', { status: statusLabel })
                        : tCommon('noDataAvailable')}
                  </span>
                </div>
                <span className="text-[12px] text-app-on-surface-variant flex items-center gap-1">
                  <Clock size={12} />
                  {tCommon('recordedAt', {
                    time: formatTimestamp(recordedAt || lastSeenAt, tCommon('noDataAvailable')),
                  })}
                </span>
              </div>
              {hasTelemetry ? (
                <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
                  {tWater('qualityQuote')}
                </p>
              ) : (
                <p className="text-[14px] text-app-on-surface-variant">
                  {isTelemetryStale
                    ? `${tSoil('realtimeUpdate')}: ${tCommon('stale')}`
                    : tSoil('noDataNotice')}
                </p>
              )}
            </section>

            {/* Stale Alert Banner */}
            {isTelemetryStale && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                <p className="text-[13px] leading-5 text-amber-800 dark:text-amber-300 font-medium">
                  {tSoil('realtimeUpdate')}: {tCommon('stale')}
                </p>
              </div>
            )}

            {/* EC Gauge Card */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center animate-fade-in">
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant self-start mb-4">
                {tWater('ecCardTitle')}
              </h3>
              <ECGauge value={ecVal} />
            </section>

            {/* pH & TDS Parameter Cards */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                    {tWater('phLevelTitle')}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-bold text-app-on-surface">
                      {phVal !== null && phVal !== undefined
                        ? typeof phVal === 'number'
                          ? phVal.toFixed(2)
                          : phVal
                        : '-'}
                    </span>
                    <span className="text-[12px] text-app-on-surface-variant">
                      {phVal !== null ? tCommon('normal') : ''}
                    </span>
                  </div>
                </div>
                <PHBar value={phVal} />
              </div>

              <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                    {tWater('tdsCardTitle')}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-bold text-app-on-surface">
                      {tdsVal !== null && tdsVal !== undefined ? tdsVal : '-'}
                    </span>
                    <span className="text-[12px] text-app-on-surface-variant">ppm</span>
                  </div>
                </div>
                {tdsVal !== null && (
                  <div className="mt-4 flex items-center gap-1 text-app-primary">
                    <TrendingUp size={14} />
                    <span className="text-[12px] font-semibold">{tWater('statusOptimal')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Historical Trend Chart Section */}
            <div className="animate-fade-in space-y-2">
              <HistoricalChartControls
                domain="water"
                selectedMetric={selectedMetric}
                onSelectMetric={setSelectedMetric}
                preset={preset}
                onSelectPreset={setPreset}
                customFrom={customFrom}
                onCustomFromChange={setCustomFrom}
                customTo={customTo}
                onCustomToChange={setCustomTo}
                dateRangeError={dateRangeError}
              />
              <WaterNutrientChart
                data={historyData}
                selectedMetric={selectedMetric}
                preset={preset}
                loading={historyLoading}
                error={historyError}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
