'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';
import {
  CheckCircle,
  TrendingUp,
  Cpu,
  Thermometer,
  Droplets,
  Activity,
  Gauge,
  Clock,
  AlertTriangle,
} from 'lucide-react';
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

interface NPKMeterProps {
  label: string;
  symbol: string;
  value: number | null | undefined;
  unit: string;
  percent: number;
  status: string;
  description: string;
  color: string;
}

function NPKMeter({
  label,
  symbol,
  value,
  unit,
  percent,
  status,
  description,
  color,
}: NPKMeterProps) {
  const tSoil = useTranslations('soil');
  const displayVal = value !== null && value !== undefined && !isNaN(value) ? value : '-';

  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[14px]"
              style={{ background: color }}
            >
              {symbol}
            </div>
            <span className="text-[14px] leading-5 font-semibold text-app-on-surface-variant">
              {label}
            </span>
          </div>
          <p className="text-[12px] leading-4 text-app-on-surface-variant pl-10">{description}</p>
        </div>
        <div className="text-right">
          <span className="text-[28px] leading-9 font-bold text-app-on-surface">{displayVal}</span>
          <span className="text-[12px] leading-4 text-app-on-surface-variant ml-1">{unit}</span>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-app-surface-container mb-2">
        <div className="gauge-bar-gradient absolute inset-0 rounded-full" />
        <div
          className="absolute top-0 right-0 bottom-0 bg-app-surface-container/60 rounded-r-full transition-all duration-700"
          style={{ width: `${100 - percent}%` }}
        />
        {/* Marker at current value */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-sm"
          style={{ left: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[11px] text-app-on-surface-variant">{tSoil('low')}</span>
        <div className="flex items-center gap-1">
          <CheckCircle size={14} className="text-app-primary" />
          <span className="text-[12px] font-semibold text-app-primary">{status}</span>
        </div>
        <span className="text-[11px] text-app-on-surface-variant">{tSoil('high')}</span>
      </div>
    </div>
  );
}

interface SoilParamCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
}

function SoilParamCard({ label, value, unit, icon }: SoilParamCardProps) {
  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-4 border border-app-outline-variant/30 soft-elevation transition-all hover:border-app-primary/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-app-primary bg-app-primary/10">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[24px] leading-8 font-bold text-app-on-surface">{value}</span>
        {unit && (
          <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SoilPage() {
  const tSoil = useTranslations('soil');
  const tCommon = useTranslations('common');
  const { selectedDevice } = useDeviceContext();
  const { snapshot, isStale } = useLatestMonitoring();

  const isSoilNode = selectedDevice?.deviceType === 'SOIL_NODE';
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

  // Real telemetry values (with null preservation)
  const nVal = soilData?.nitrogen ?? null;
  const pVal = soilData?.phosphorus ?? null;
  const kVal = soilData?.potassium ?? null;
  const tempVal = soilData?.temperature ?? null;
  const moistureVal = soilData?.moisture ?? null;
  const phVal = soilData?.ph ?? null;
  const ecVal = soilData?.ec ?? null;

  // Converted presentation EC: stored in mS/cm, displayed in µS/cm (x1000)
  const ecDisplayVal = ecVal !== null && ecVal !== undefined ? Math.round(ecVal * 1000) : null;

  // Safe percentage calculations for display meters
  const calcPct = (val: number | null, maxNominal: number) => {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Math.min(100, Math.max(0, Math.round((val / maxNominal) * 100)));
  };

  const npkItems: NPKMeterProps[] = [
    {
      label: `${tSoil('nitrogen')} (N)`,
      symbol: 'N',
      value: nVal,
      unit: 'mg/kg',
      percent: calcPct(nVal, 250),
      status: soilData?.status || tSoil('idealStatus'),
      description: tSoil('leafGrowthDesc'),
      color: '#0d631b',
    },
    {
      label: `${tSoil('phosphorus')} (P)`,
      symbol: 'P',
      value: pVal,
      unit: 'mg/kg',
      percent: calcPct(pVal, 100),
      status: soilData?.status || tSoil('idealStatus'),
      description: tSoil('rootGrowthDesc'),
      color: '#884200',
    },
    {
      label: `${tSoil('potassium')} (K)`,
      symbol: 'K',
      value: kVal,
      unit: 'mg/kg',
      percent: calcPct(kVal, 300),
      status: soilData?.status || tSoil('idealStatus'),
      description: tSoil('fruitQualityDesc'),
      color: '#476800',
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
                      isStale ? 'bg-amber-500' : 'bg-app-primary animate-pulse'
                    }`}
                  />
                  <span
                    className={`text-[14px] font-semibold ${
                      isStale ? 'text-amber-700 dark:text-amber-400' : 'text-app-primary'
                    }`}
                  >
                    {isStale
                      ? tCommon('stale')
                      : soilData?.status
                      ? `${tSoil('status')}: ${soilData.status}`
                      : tSoil('npkOptimal')}
                  </span>
                </div>
                <span className="text-[12px] text-app-on-surface-variant flex items-center gap-1">
                  <Clock size={12} />
                  {tCommon('recordedAt', {
                    time: formatTimestamp(recordedAt, tCommon('noDataAvailable')),
                  })}
                </span>
              </div>
              <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
                {tSoil('fertilizerQuote')}
              </p>
              <div className="mt-3 flex items-center gap-2 bg-app-primary/5 px-4 py-2 rounded-full w-fit">
                <TrendingUp size={16} className="text-app-primary" />
                <span className="text-[14px] font-semibold text-app-primary">
                  {tSoil('idealPhase')}
                </span>
              </div>
            </section>

            {/* Stale Alert Banner */}
            {isStale && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                <p className="text-[13px] leading-5 text-amber-800 dark:text-amber-300 font-medium">
                  {tSoil('realtimeUpdate')}: {tCommon('stale')}
                </p>
              </div>
            )}

            {/* Primary NPK Meters */}
            <div className="space-y-4 animate-fade-in">
              {npkItems.map((item) => (
                <NPKMeter key={item.symbol} {...item} />
              ))}
            </div>

            {/* Environmental & Chemical Soil Parameters (Temperature, Moisture, pH, EC) */}
            <section className="space-y-2 animate-fade-in">
              <h3 className="text-[15px] font-bold text-app-on-surface px-1">
                {tSoil('soilMonitoringTitle')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SoilParamCard
                  label={tSoil('temperature')}
                  value={formatValue(tempVal, 1)}
                  unit="°C"
                  icon={<Thermometer size={16} />}
                />
                <SoilParamCard
                  label={tSoil('moisture')}
                  value={formatValue(moistureVal, 1)}
                  unit="%RH"
                  icon={<Droplets size={16} />}
                />
                <SoilParamCard
                  label={tSoil('ph')}
                  value={formatValue(phVal, 2)}
                  icon={<Activity size={16} />}
                />
                <SoilParamCard
                  label={tSoil('ec')}
                  value={formatValue(ecDisplayVal, 0)}
                  unit="µS/cm"
                  icon={<Gauge size={16} />}
                />
              </div>
            </section>

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
                loading={historyLoading}
                error={historyError}
              />
            </div>

            {/* Recommendation */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in">
              <h3 className="text-[20px] leading-7 font-bold text-app-on-surface mb-3">
                {tSoil('recommendationTitle')}
              </h3>
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
            </section>
          </>
        )}
      </main>
    </div>
  );
}
