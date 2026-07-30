'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import { WATER_DATA, IRRIGATION_PHASES } from '@/lib/constants';
import { CheckCircle, TrendingUp, Waves, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

const WaterNutrientChart = dynamic(() => import('@/components/charts/WaterNutrientChart'), {
  ssr: false,
});

// EC Half-gauge
function ECGauge({ value }: { value: number }) {
  // EC range: 0 - 4 mS/cm → 0 to 270 degrees
  const maxEC = 4;
  const angle = -135 + (value / maxEC) * 270;
  return (
    <div className="flex flex-col items-center mb-2">
      <div className="relative" style={{ width: 180, height: 90, overflow: 'hidden' }}>
        {/* Track */}
        <div className="ec-gauge-track absolute top-0 left-0" />
        {/* Fill */}
        <div className="ec-gauge-fill" style={{ transform: `rotate(${angle - 90}deg)` }} />
        {/* Value overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-[28px] leading-9 font-bold text-app-primary">{value}</span>
          <span className="text-[12px] leading-4 text-app-on-surface-variant">mS/cm</span>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-app-primary/10 px-4 py-1.5 rounded-full mt-2">
        <CheckCircle size={16} className="text-app-primary" />
        <span className="text-[14px] font-semibold text-app-primary">Status: Stabil</span>
      </div>
    </div>
  );
}

// pH bar
function PHBar({ value }: { value: number }) {
  const pct = ((value - 1) / 13) * 100;
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

export default function AirPage() {
  const [activePhase, setActivePhase] = useState(1);
  const [valveOpen, setValveOpen] = useState(false);

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-[1rem] space-y-5">
        {/* Status Overview */}
        <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
              <span className="text-[14px] font-semibold text-app-primary">
                Status Air: Optimal
              </span>
            </div>
            <span className="text-[12px] text-app-on-surface-variant">Update: 2 mnt lalu</span>
          </div>
          <p className="text-[18px] leading-7 font-semibold text-app-on-surface">
            "Air nutrisi pas. Tidak terlalu pekat."
          </p>
        </section>

        {/* EC Gauge (large) */}
        <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col items-center animate-fade-in">
          <h3 className="text-[14px] font-semibold text-app-on-surface-variant self-start mb-4">
            Electrical Conductivity (EC)
          </h3>
          <ECGauge value={WATER_DATA.ec.value} />
        </section>

        {/* 2-col metric grid */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          {/* pH */}
          <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                pH Level
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-app-on-surface">
                  {WATER_DATA.ph.value}
                </span>
                <span className="text-[12px] text-app-on-surface-variant">
                  {WATER_DATA.ph.status}
                </span>
              </div>
            </div>
            <PHBar value={WATER_DATA.ph.value} />
          </div>

          {/* TDS */}
          <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                Total Dissolved Solids
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-app-on-surface">
                  {WATER_DATA.tds.value}
                </span>
                <span className="text-[12px] text-app-on-surface-variant">ppm</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-app-primary">
              <TrendingUp size={14} />
              <span className="text-[12px] font-semibold">{WATER_DATA.tds.status}</span>
            </div>
          </div>

          {/* Tank Volume */}
          <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                Volume Air Tandon
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-app-on-surface">
                  {WATER_DATA.tankVolume.value}
                </span>
                <span className="text-[12px] text-app-on-surface-variant">Liter</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-app-surface-container relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 bottom-0 bg-app-primary rounded-full transition-all duration-700"
                  style={{ width: `${WATER_DATA.tankVolume.percent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-bold text-app-on-surface-variant">0L</span>
                <span className="text-[10px] font-bold text-app-on-surface-variant">
                  {WATER_DATA.tankVolume.max}L
                </span>
              </div>
            </div>
          </div>

          {/* Flow Rate */}
          <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-app-on-surface-variant mb-2">
                Debit Air
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-app-on-surface">
                  {WATER_DATA.flowRate.value}
                </span>
                <span className="text-[12px] text-app-on-surface-variant">L/mnt</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-app-primary">
              <Waves size={14} />
              <span className="text-[12px] font-semibold">{WATER_DATA.flowRate.status}</span>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="animate-fade-in">
          <WaterNutrientChart />
        </div>

        {/* Irrigation Phases */}
        <section className="space-y-3 animate-fade-in">
          <h3 className="text-[20px] leading-7 font-bold text-app-on-surface">
            Pilihan Fase Pengairan
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {IRRIGATION_PHASES.map((phase) => (
              <button
                key={phase.id}
                onClick={() => setActivePhase(phase.id)}
                className={cn(
                  'flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer',
                  activePhase === phase.id
                    ? 'border-app-primary bg-app-primary/5 text-app-primary'
                    : 'border-app-outline-variant/30 bg-app-surface-container-lowest text-app-on-surface-variant hover:border-app-primary/50'
                )}
              >
                <span className="text-[14px] font-bold">{phase.label}</span>
                <span className="text-[10px]">{phase.volume}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Valve Control */}
        <section className="bg-app-surface-container-lowest rounded-xl p-4 soft-elevation border border-app-outline-variant/30 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-app-primary/10 flex items-center justify-center text-app-primary">
              <Droplets size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-app-on-surface">Kontrol Kran Air</p>
              <p className="text-[12px] text-app-on-surface-variant">
                Status: {valveOpen ? 'Terbuka' : 'Tertutup'}
              </p>
            </div>
          </div>
          <div className="flex bg-app-surface-container rounded-full p-1">
            <button
              onClick={() => setValveOpen(false)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[12px] font-bold transition-all cursor-pointer',
                !valveOpen
                  ? 'bg-white shadow-sm text-app-on-surface'
                  : 'text-app-on-surface-variant'
              )}
            >
              Tutup
            </button>
            <button
              onClick={() => setValveOpen(true)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[12px] font-bold transition-all cursor-pointer',
                valveOpen ? 'bg-white shadow-sm text-app-on-surface' : 'text-app-on-surface-variant'
              )}
            >
              Buka
            </button>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
