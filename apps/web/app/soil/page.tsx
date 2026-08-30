'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';
import { CheckCircle, TrendingUp, Cpu, Clock, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

const NPKChart = dynamic(() => import('@/components/charts/NPKChart'), { ssr: false });

// Helper to format numeric values cleanly or return placeholder
function formatValue(val: number | null | undefined, decimals = 1, fallback = '-'): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return Number.isInteger(val) ? val.toString() : val.toFixed(decimals);
}

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

interface SoilMetricMeterProps {
  label: string;
  symbol: string;
  value: number | null | undefined;
  formattedValue?: string;
  unit: string;
  percent: number | null;
  status: string | null;
  description: string;
  color: string;
}

function SoilMetricMeter({
  label,
  symbol,
  value,
  formattedValue,
  unit,
  percent,
  status,
  description,
  color,
}: SoilMetricMeterProps) {
  const tSoil = useTranslations('soil');
  const hasValue = value !== null && value !== undefined && !isNaN(value);
  const displayVal = formattedValue ?? (hasValue ? value.toString() : '-');
  const displayPercent = hasValue && percent !== null ? percent : 0;
  const displayStatus = hasValue && status ? status : '-';

  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 transition-all hover:border-app-primary/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[13px] tracking-tight shrink-0 shadow-sm"
              style={{ background: color }}
            >
              {symbol}
            </div>
            <span className="text-[14px] leading-5 font-semibold text-app-on-surface">{label}</span>
          </div>
          <p className="text-[12px] leading-4 text-app-on-surface-variant pl-10">{description}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[28px] leading-9 font-bold text-app-on-surface">{displayVal}</span>
          {unit && (
            <span className="text-[12px] leading-4 text-app-on-surface-variant ml-1">{unit}</span>
          )}
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-app-surface-container mb-2">
        <div className="gauge-bar-gradient absolute inset-0 rounded-full" />
        <div
          className="absolute top-0 right-0 bottom-0 bg-app-surface-container/80 rounded-r-full transition-all duration-700"
          style={{ width: `${100 - displayPercent}%` }}
        />
        {/* Marker at current value (rendered strictly when real data exists) */}
        {hasValue && percent !== null && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-md rounded-full -ml-0.5"
            style={{ left: `${displayPercent}%` }}
          />
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] text-app-on-surface-variant">
        <span>{tSoil('low')}</span>
        <div className="flex items-center gap-1">
          {hasValue && status && status !== '-' && (
            <CheckCircle size={13} className="text-app-primary" />
          )}
          <span
            className={`text-[12px] font-semibold ${
              hasValue && status && status !== '-'
                ? 'text-app-primary'
                : 'text-app-on-surface-variant'
            }`}
          >
            {displayStatus}
          </span>
        </div>
        <span>{tSoil('high')}</span>
      </div>
    </div>
  );
}

export default function SoilPage() {
  const tSoil = useTranslations('soil');
  const tCommon = useTranslations('common');
  const { selectedDevice } = useDeviceContext();
  const { snapshot, isStale } = useLatestMonitoring();

  const deviceType = selectedDevice?.deviceType;
  const isWaterNode = deviceType === 'WATER_QUALITY_NODE' || deviceType === 'WATER_TANK_NODE';
  const isSoilNode = !isWaterNode;
  const activeDeviceId = isSoilNode ? selectedDevice?.id || selectedDevice?.deviceId || null : null;

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
    domain: 'soil',
    initialMetric: 'npk',
  });

  const soilData = snapshot?.soil?.data;
  const recordedAt = snapshot?.soil?.recordedAt;
  const lastSeenAt = snapshot?.lastSeenAt || selectedDevice?.lastSeenAt;

  // Stale evaluation: top-level hook isStale, top-level connectionStatus === 'STALE', or domain isStale
  const isTelemetryStale = Boolean(
    isStale || snapshot?.soil?.isStale || snapshot?.connectionStatus === 'STALE'
  );

  // Real telemetry values (with strict null preservation; suppressed when telemetry is stale or not present)
  const nVal = !isTelemetryStale ? (soilData?.nitrogen ?? null) : null;
  const pVal = !isTelemetryStale ? (soilData?.phosphorus ?? null) : null;
  const kVal = !isTelemetryStale ? (soilData?.potassium ?? null) : null;
  const tempVal = !isTelemetryStale ? (soilData?.temperature ?? null) : null;
  const moistureVal = !isTelemetryStale ? (soilData?.moisture ?? null) : null;
  const phVal = !isTelemetryStale ? (soilData?.ph ?? null) : null;
  const ecVal = !isTelemetryStale ? (soilData?.ec ?? null) : null;

  // Converted presentation EC: stored in mS/cm, displayed in µS/cm (x1000)
  const ecDisplayVal = ecVal !== null && ecVal !== undefined ? Math.round(ecVal * 1000) : null;

  // Check whether any valid, fresh telemetry reading exists
  const hasTelemetry = Boolean(
    !isTelemetryStale &&
    soilData &&
    (nVal !== null ||
      pVal !== null ||
      kVal !== null ||
      tempVal !== null ||
      moistureVal !== null ||
      phVal !== null ||
      ecVal !== null)
  );

  // Safe percentage calculation for meter fill bars
  const calcPct = (val: number | null | undefined, maxNominal: number): number | null => {
    if (val === null || val === undefined || isNaN(val)) return null;
    return Math.min(100, Math.max(0, Math.round((val / maxNominal) * 100)));
  };

  const npkItems: SoilMetricMeterProps[] = [
    {
      label: `${tSoil('nitrogen')} (N)`,
      symbol: 'N',
      value: nVal,
      unit: 'mg/kg',
      percent: calcPct(nVal, 250),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('leafGrowthDesc'),
      color: '#0d631b',
    },
    {
      label: `${tSoil('phosphorus')} (P)`,
      symbol: 'P',
      value: pVal,
      unit: 'mg/kg',
      percent: calcPct(pVal, 100),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('rootGrowthDesc'),
      color: '#884200',
    },
    {
      label: `${tSoil('potassium')} (K)`,
      symbol: 'K',
      value: kVal,
      unit: 'mg/kg',
      percent: calcPct(kVal, 300),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('fruitQualityDesc'),
      color: '#476800',
    },
  ];

  const envItems: SoilMetricMeterProps[] = [
    {
      label: tSoil('temperature'),
      symbol: '°C',
      value: tempVal,
      formattedValue: formatValue(tempVal, 1),
      unit: '°C',
      percent: calcPct(tempVal, 50),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('tempDesc'),
      color: '#c05621',
    },
    {
      label: tSoil('moisture'),
      symbol: '%',
      value: moistureVal,
      formattedValue: formatValue(moistureVal, 1),
      unit: '%RH',
      percent: calcPct(moistureVal, 100),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('moistureDesc'),
      color: '#0284c7',
    },
    {
      label: tSoil('ph'),
      symbol: 'pH',
      value: phVal,
      formattedValue: formatValue(phVal, 2),
      unit: '',
      percent: calcPct(phVal, 14),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('phDesc'),
      color: '#7c3aed',
    },
    {
      label: tSoil('ec'),
      symbol: 'EC',
      value: ecDisplayVal,
      formattedValue: formatValue(ecDisplayVal, 0),
      unit: 'µS/cm',
      percent: calcPct(ecDisplayVal, 3000),
      status: hasTelemetry ? soilData?.status || tSoil('idealStatus') : null,
      description: tSoil('ecDesc'),
      color: '#0891b2',
    },
  ];

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto space-y-5">
        {!isSoilNode && selectedDevice && (
          <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center text-center animate-fade-in space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-app-on-surface">
                {tSoil('notSoilNodeTitle')}
              </h3>
              <p className="text-[12px] text-app-on-surface-variant mt-1 max-w-sm">
                {tSoil('soilDeviceNotice', {
                  deviceName: selectedDevice?.deviceName,
                  deviceType: selectedDevice?.deviceType.replace('_NODE', ''),
                })}
              </p>
            </div>
          </section>
        )}

        {isSoilNode && (
          <>
            {/* Status Overview & Real-Time Header */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
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
                        ? soilData?.status
                          ? `${tSoil('status')}: ${soilData.status}`
                          : tSoil('npkOptimal')
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
                <>
                  <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
                    {tSoil('fertilizerQuote')}
                  </p>
                  <div className="mt-3 flex items-center gap-2 bg-app-primary/5 px-4 py-2 rounded-full w-fit">
                    <TrendingUp size={16} className="text-app-primary" />
                    <span className="text-[14px] font-semibold text-app-primary">
                      {tSoil('idealPhase')}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-[14px] text-app-on-surface-variant py-1">
                  <Info size={16} className="text-app-on-surface-variant shrink-0" />
                  <p>
                    {isTelemetryStale
                      ? `${tSoil('realtimeUpdate')}: ${tCommon('stale')}`
                      : tSoil('noDataNotice')}
                  </p>
                </div>
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

            {/* Primary NPK Meters */}
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-[13px] font-bold text-app-on-surface-variant tracking-wider uppercase px-1">
                {tSoil('mainNutrients')}
              </h3>
              {npkItems.map((item) => (
                <SoilMetricMeter key={item.symbol} {...item} />
              ))}
            </div>

            {/* Environmental & Chemical Soil Parameters (Temperature, Moisture, pH, EC) */}
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-[13px] font-bold text-app-on-surface-variant tracking-wider uppercase px-1">
                {tSoil('environmentalParams')}
              </h3>
              {envItems.map((item) => (
                <SoilMetricMeter key={item.symbol} {...item} />
              ))}
            </div>

            {/* Historical Trend Chart Section */}
            <div className="animate-fade-in space-y-2">
              <HistoricalChartControls
                domain="soil"
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
              <NPKChart
                data={historyData}
                selectedMetric={selectedMetric}
                preset={preset}
                loading={historyLoading}
                error={historyError}
              />
            </div>

            {/* Recommendation */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in">
              <h3 className="text-[20px] leading-7 font-bold text-app-on-surface mb-3">
                {tSoil('recommendationTitle')}
              </h3>
              {hasTelemetry ? (
                <div className="space-y-3">
                  {[
                    { label: tSoil('nitrogen'), rec: tSoil('maintainCurrentLevel') },
                    { label: tSoil('phosphorus'), rec: tSoil('addPhosThisWeek') },
                    { label: tSoil('potassium'), rec: tSoil('maintainCurrentLevel') },
                  ].map(({ label, rec }) => (
                    <div key={label} className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-app-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[14px] font-semibold text-app-on-surface">{label}</p>
                        <p className="text-[12px] text-app-on-surface-variant">{rec}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[14px] text-app-on-surface-variant py-1">
                  <Info size={16} className="text-app-on-surface-variant shrink-0" />
                  <p>{tSoil('noDataNotice')}</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
