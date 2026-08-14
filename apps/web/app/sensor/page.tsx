'use client';

import React from 'react';
import Link from 'next/link';
import TopAppBar from '@/components/navigation/TopAppBar';
import { useDeviceContext } from '@/context/DeviceContext';
import { Sprout, Droplets, Database, ChevronRight } from 'lucide-react';
import { formatDeviceDisplayName } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export default function SensorPage() {
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');
  const { selectedDevice } = useDeviceContext();

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-5">
        {/* Intro Header */}
        <section className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
              <Sprout size={22} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-app-on-surface">
                {tDevices('sensorTitle')}
              </h1>
              <p className="text-[12px] text-app-on-surface-variant">
                {tDevices('sensorSubtitle')}
              </p>
            </div>
          </div>

          {selectedDevice && (
            <div className="mt-3 p-3 bg-app-surface-container rounded-xl flex items-center justify-between text-xs">
              <span className="font-semibold text-app-on-surface">
                {tDevices('sensorSelectedDevice', {
                  deviceName: formatDeviceDisplayName(selectedDevice, tDevices),
                })}
              </span>
              <span className="font-mono text-[11px] text-app-primary font-bold px-2 py-0.5 bg-app-primary/10 rounded-lg">
                {selectedDevice.deviceType}
              </span>
            </div>
          )}
        </section>

        {/* Category Navigation Cards */}
        <div className="space-y-3">
          <h2 className="text-[15px] font-bold text-app-on-surface px-1">
            {tDevices('sensorCategoriesTitle')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Soil Sensor Card */}
            <Link
              href="/soil"
              className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg hover:border-app-primary/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
                  <Sprout size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface group-hover:text-app-primary transition-colors">
                  {tDevices('sensorSoilTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorSoilDesc')}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-app-primary pt-3 border-t border-app-outline-variant/20">
                <span>{tCommon('viewDetails')}</span>
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </div>
            </Link>

            {/* Water Quality Card */}
            <Link
              href="/water"
              className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg hover:border-app-primary/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 mb-3 group-hover:scale-105 transition-transform">
                  <Droplets size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface group-hover:text-app-primary transition-colors">
                  {tDevices('sensorWaterTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorWaterDesc')}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-app-primary pt-3 border-t border-app-outline-variant/20">
                <span>{tCommon('viewDetails')}</span>
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </div>
            </Link>

            {/* Water Tank Card */}
            <Link
              href="/controls"
              className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg hover:border-app-primary/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-105 transition-transform">
                  <Database size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface group-hover:text-app-primary transition-colors">
                  {tDevices('sensorControlsTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorControlsDesc')}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-app-primary pt-3 border-t border-app-outline-variant/20">
                <span>{tCommon('viewDetails')}</span>
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
