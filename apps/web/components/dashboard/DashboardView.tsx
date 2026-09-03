'use client';

import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import WeatherCard from '@/components/dashboard/WeatherCard';
import { useAuth } from '@/context/AuthContext';
import { useDeviceContext } from '@/context/DeviceContext';
import { Cpu, Activity } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

export default function DashboardView() {
  const tDash = useTranslations('dashboard');
  const locale = useLocale();

  const { user } = useAuth();
  const { devices } = useDeviceContext();

  const rawName = user?.fullName || user?.email || '';
  const userName = rawName.replace(/^pak\s+/i, '').trim();

  const onlineDevicesCount = devices.filter((d) => d.connectionStatus === 'ONLINE').length;
  const offlineOrStaleCount = devices.length - onlineDevicesCount;

  // Format today's localized date
  const todayFormatted = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-16">
      <TopAppBar />

      <main className="pt-20 sm:pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* ── Top Section: Hero / System Overview Card with Operational Device Metrics ─── */}
        <section className="bg-app-surface-container-lowest rounded-2xl p-6 sm:p-8 lg:p-9 soft-elevation-lg border border-app-outline-variant/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Clean Greeting without Emojis */}
            <h1 className="text-[24px] sm:text-[28px] lg:text-[32px] font-extrabold text-app-on-surface tracking-tight">
              {tDash('greeting', { name: userName ? `, ${userName}` : '' })}
            </h1>
            {/* Localized Current Date */}
            <span className="text-[12px] sm:text-[13px] font-medium text-app-on-surface-variant">
              {todayFormatted}
            </span>
          </div>

          {/* Operational Node Summary Bar */}
          <div className="mt-6 pt-6 border-t border-app-outline-variant/30 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Total Registered Nodes */}
            <div className="bg-app-surface-container-low rounded-xl p-4 border border-app-outline-variant/40 flex items-center justify-between">
              <div>
                <span className="text-[12px] font-medium text-app-on-surface-variant block mb-1">
                  {tDash('totalDevices')}
                </span>
                <span className="text-[22px] sm:text-[26px] font-extrabold text-app-on-surface">
                  {devices.length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-app-surface-container-high text-app-on-surface-variant flex items-center justify-center flex-shrink-0">
                <Cpu size={18} />
              </div>
            </div>

            {/* Online Connected Nodes */}
            <div className="bg-app-primary text-white rounded-xl p-4 border border-app-primary shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[12px] font-bold text-app-on-primary-container block mb-1">
                  {tDash('onlineDevices')}
                </span>
                <span className="text-[22px] sm:text-[26px] font-extrabold text-white">
                  {onlineDevicesCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-app-primary-fixed text-app-on-primary-fixed flex items-center justify-center flex-shrink-0">
                <Activity size={18} className="text-app-on-primary-fixed" />
              </div>
            </div>

            {/* Offline or Stale Nodes */}
            <div className="bg-app-surface-container-low rounded-xl p-4 border border-app-outline-variant/40 flex items-center justify-between">
              <div>
                <span className="text-[12px] font-medium text-app-on-surface-variant block mb-1">
                  {tDash('offlineDevices')}
                </span>
                <span className="text-[22px] sm:text-[26px] font-extrabold text-app-on-surface-variant">
                  {offlineOrStaleCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-app-surface-container-high flex items-center justify-center flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-app-outline" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Below Section: Full-Width Environmental Weather Card ─── */}
        <section>
          <WeatherCard />
        </section>
      </main>
    </div>
  );
}
