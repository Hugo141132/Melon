'use client';

import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import NPKChart from '@/components/charts/NPKChart';
import { NPK_DATA, NPK_RANGES } from '@/lib/constants';
import { CheckCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function TanahPage() {
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

      <main className="pt-20 px-[1rem] space-y-5">
        {/* Status Overview */}
        <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
              <span className="text-[14px] font-semibold text-app-primary">
                Status NPK: Optimal
              </span>
            </div>
            <span className="text-[12px] text-app-on-surface-variant">Update: 5 mnt lalu</span>
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

        {/* Trend Chart */}
        <div className="animate-fade-in">
          <NPKChart />
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
      </main>

      <BottomNav />
    </div>
  );
}
