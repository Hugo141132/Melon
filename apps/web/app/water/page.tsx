'use client';

import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import { useDeviceContext } from '@/context/DeviceContext';
import { useLatestMonitoring } from '@/hooks/useLatestMonitoring';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';
import { WATER_DATA } from '@/lib/constants';
import { CheckCircle, TrendingUp, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';

const WaterNutrientChart = dynamic(() => import('@/components/charts/WaterNutrientChart'), {
  ssr: false,
});

function ECGauge({ value }: { value: number }) {
  const tWater = useTranslations('water');
  // Explicit presentation conversion from source unit (mS/cm) to display unit (µS/cm)
  const displayVal = Math.round(value * 1000);
  const maxEC = 4000;
  const angle = -135 + (Math.min(displayVal, maxEC) / maxEC) * 270;
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
      <div className="flex items-center gap-2 bg-app-primary/10 px-4 py-1.5 rounded-full mt-2">
        <CheckCircle size={16} className="text-app-primary" />
        <span className="text-[14px] font-semibold text-app-primary">{tWater('statusStable')}</span>
      </div>
    </div>
  );
}

// pH bar for Water Quality Node
function PHBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, ((value - 1) / 13) * 100));
  return (
    <div className="mt-4">
      <div className="h-2 w-full rounded-full ph-gradient relative overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-sm rounded-full border border-app-outline/20"
          style={{ left: `${pct}%` }}
        />
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
  const { snapshot } = useLatestMonitoring();

  const deviceType = selectedDevice?.deviceType;

  const isTankNode = deviceType === 'WATER_TANK_NODE';
  const isSoilNode = deviceType === 'SOIL_NODE';
  const isQualityNode = !isTankNode && !isSoilNode;

  const activeDeviceId = isQualityNode ? selectedDevice?.deviceId || selectedDevice?.id : null;

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
  const phVal = waterData?.ph ?? WATER_DATA.ph.value;
  const tdsVal = waterData?.tds ?? WATER_DATA.tds.value;
  const ecVal = waterData?.ec ?? WATER_DATA.ec.value;
  const statusLabel = waterData?.status || tCommon('optimal');

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar />

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
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
                  <span className="text-[14px] font-semibold text-app-primary">
                    {tWater('statusLabel', { status: statusLabel })}
                  </span>
                </div>
                <span className="text-[12px] text-app-on-surface-variant">
                  {tSoil('realtimeUpdate')}
                </span>
              </div>
              <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
                {tWater('qualityQuote')}
              </p>
            </section>

            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center animate-fade-in">
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant self-start mb-4">
                {tWater('ecCardTitle')}
              </h3>
              <ECGauge value={ecVal} />
            </section>

            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                    {tWater('phLevelTitle')}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-bold text-app-on-surface">{phVal}</span>
                    <span className="text-[12px] text-app-on-surface-variant">
                      {tCommon('normal')}
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
                    <span className="text-[28px] font-bold text-app-on-surface">{tdsVal}</span>
                    <span className="text-[12px] text-app-on-surface-variant">ppm</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-app-primary">
                  <TrendingUp size={14} />
                  <span className="text-[12px] font-semibold">{tWater('statusOptimal')}</span>
                </div>
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
