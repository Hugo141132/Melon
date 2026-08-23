'use client';

import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { DASHBOARD_DATA } from '@/lib/constants';
import { Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

// ─── Health Score Half Gauge ────────────────────────────
function HealthScoreGauge({ score }: { score: number }) {
  const tDash = useTranslations('dashboard');
  const angle = -135 + (score / 100) * 270;
  return (
    <div className="flex flex-col items-center">
      <div className="gauge-container mb-2">
        <div className="ec-gauge-track" />
        <div className="ec-gauge-fill" style={{ transform: `rotate(${angle - 90}deg)` }} />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span className="text-[28px] leading-9 font-bold text-app-primary">{score}</span>
          <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
            /100
          </span>
        </div>
      </div>
      <span className="text-[14px] leading-5 font-semibold text-app-primary">
        {tDash('healthExcellent')}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const tDash = useTranslations('dashboard');
  const { user } = useAuth();

  const rawName = user?.fullName || user?.email || '';
  const userName = rawName.replace(/^pak\s+/i, '');

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar />

      <main className="pt-20 px-[1rem] space-y-5">
        {/* ── Hero Greeting Section ─── */}
        <section className="bg-app-surface-container-lowest rounded-2xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
                <span className="text-[12px] leading-4 font-semibold text-app-primary">
                  {tDash('realtimeSystem')}
                </span>
              </div>
              <h2 className="text-[20px] leading-7 font-bold text-app-on-surface mb-1">
                {tDash('greeting', { name: userName ? `, ${userName}` : '' })} 👋
              </h2>
              <p className="text-[16px] leading-6 text-app-on-surface-variant">
                {tDash('farmConditionOptimal')}
              </p>
            </div>

            <HealthScoreGauge score={DASHBOARD_DATA.healthScore} />
          </div>
        </section>

        {/* ── Weather Summary Card (Green Box) ─── */}
        <section className="bg-app-primary text-white rounded-2xl p-5 flex items-center justify-between soft-elevation-lg animate-fade-in">
          <div>
            <p className="text-[12px] leading-4 font-medium opacity-80 mb-1">
              {tDash('weatherTitle')}
            </p>
            <h3 className="text-[20px] leading-7 font-bold mb-1">{tDash('weatherCondition')}</h3>
            <p className="text-[14px] leading-5 opacity-80">{tDash('weatherNote')}</p>
          </div>
          <div className="text-right">
            <div className="text-[40px] leading-none font-bold mb-1">
              {DASHBOARD_DATA.weather.temp}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Sun size={14} className="text-yellow-300" />
              <span className="text-[12px] opacity-80">UV {DASHBOARD_DATA.weather.uvIndex}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
