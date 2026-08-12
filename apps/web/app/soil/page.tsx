'use client';

import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import { useDeviceContext } from '@/context/DeviceContext';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';
import { NPK_DATA } from '@/lib/constants';
import { CheckCircle, TrendingUp, Cpu } from 'lucide-react';

const NPKChart = dynamic(() => import('@/components/charts/NPKChart'), { ssr: false });

interface NPKMeterProps {
  label: string;
  symbol: string;
  value: number;
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
          <span className="text-[28px] leading-9 font-bold text-app-on-surface">{value}</span>
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
        <span className="text-[11px] text-app-on-surface-variant">Rendah</span>
        <div className="flex items-center gap-1">
          <CheckCircle size={14} className="text-app-primary" />
          <span className="text-[12px] font-semibold text-app-primary">{status}</span>
        </div>
        <span className="text-[11px] text-app-on-surface-variant">Tinggi</span>
      </div>
    </div>
  );
}

export default function SoilPage() {
  const { selectedDevice } = useDeviceContext();

  const isSoilNode = selectedDevice?.deviceType === 'SOIL_NODE';
  const activeDeviceId = isSoilNode ? selectedDevice?.deviceId : null;

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

  const npkItems: NPKMeterProps[] = [
    {
      label: 'Nitrogen (N)',
      symbol: 'N',
      value: NPK_DATA.nitrogen.value,
      unit: NPK_DATA.nitrogen.unit,
      percent: NPK_DATA.nitrogen.percent,
      status: NPK_DATA.nitrogen.status,
      description: 'Pertumbuhan daun & batang',
      color: '#0d631b',
    },
    {
      label: 'Fosfor (P)',
      symbol: 'P',
      value: NPK_DATA.fosfor.value,
      unit: NPK_DATA.fosfor.unit,
      percent: NPK_DATA.fosfor.percent,
      status: NPK_DATA.fosfor.status,
      description: 'Pengembangan akar & buah',
      color: '#884200',
    },
    {
      label: 'Kalium (K)',
      symbol: 'K',
      value: NPK_DATA.kalium.value,
      unit: NPK_DATA.kalium.unit,
      percent: NPK_DATA.kalium.percent,
      status: NPK_DATA.kalium.status,
      description: 'Kualitas buah & daya tahan',
      color: '#476800',
    },
  ];

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto space-y-5">
        {!isSoilNode && selectedDevice && (
          <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center text-center animate-fade-in space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-app-on-surface">
                Bukan Perangkat Pemantauan Tanah
              </h3>
              <p className="text-[12px] text-app-on-surface-variant mt-1 max-w-sm">
                Perangkat{' '}
                <code className="bg-app-surface-container px-1 py-0.5 rounded font-mono">
                  {selectedDevice?.deviceName}
                </code>{' '}
                adalah node pemantauan {selectedDevice?.deviceType.replace('_NODE', '')}. Pilih Soil
                Node di selector untuk melihat data tanah.
              </p>
            </div>
          </section>
        )}

        {isSoilNode && (
          <>
            {/* Status Overview */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
                  <span className="text-[14px] font-semibold text-app-primary">
                    Status NPK: Optimal
                  </span>
                </div>
                <span className="text-[12px] text-app-on-surface-variant">Update: Real-Time</span>
              </div>
              <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
                "Pupuk cukup, tanaman akan tumbuh kuat."
              </p>
              <div className="mt-3 flex items-center gap-2 bg-app-primary/5 px-4 py-2 rounded-full w-fit">
                <TrendingUp size={16} className="text-app-primary" />
                <span className="text-[14px] font-semibold text-app-primary">
                  Ideal for Fase Generatif
                </span>
              </div>
            </section>

            {/* NPK Meters */}
            <div className="space-y-4 animate-fade-in">
              {npkItems.map((item) => (
                <NPKMeter key={item.symbol} {...item} />
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
                loading={historyLoading}
                error={historyError}
              />
            </div>

            {/* Recommendation */}
            <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in">
              <h3 className="text-[20px] leading-7 font-bold text-app-on-surface mb-3">
                Rekomendasi Pemupukan
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Nitrogen', rec: 'Pertahankan level saat ini' },
                  { label: 'Fosfor', rec: 'Tambahkan 10 mg/kg minggu ini' },
                  { label: 'Kalium', rec: 'Pertahankan level saat ini' },
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
