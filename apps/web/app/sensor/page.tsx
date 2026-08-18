'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TopAppBar from '@/components/navigation/TopAppBar';
import { useDeviceContext } from '@/context/DeviceContext';
import { Sprout, Droplets, Database, ChevronRight } from 'lucide-react';
import { formatDeviceDisplayName } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export default function SensorPage() {
  const tDevices = useTranslations('devices');
  const { devices, selectedDevice, selectDevice, isLoading, error } = useDeviceContext();
  const router = useRouter();

  const soilDevices = devices.filter((d) => d.deviceType === 'SOIL_NODE');
  const waterDevices = devices.filter((d) => d.deviceType === 'WATER_QUALITY_NODE');
  const controlDevices = devices.filter((d) => d.deviceType === 'WATER_TANK_NODE');

  const handleDeviceSelect = (deviceId: string, route: string) => {
    selectDevice(deviceId);
    router.push(`${route}?deviceId=${deviceId}`);
  };

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
            <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
                  <Sprout size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface">
                  {tDevices('sensorSoilTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorSoilDesc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-app-outline-variant/20 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-app-on-surface-variant uppercase tracking-wider px-0.5">
                  {tDevices('devicesListTitle')}
                </span>
                {isLoading ? (
                  <div className="space-y-1.5 animate-pulse" data-testid="sensor-soil-loading">
                    <div className="h-9 bg-app-surface-container/60 rounded-lg" />
                  </div>
                ) : error && devices.length === 0 ? (
                  <div className="text-[11px] text-app-error p-2 text-center bg-app-error/10 rounded-lg">
                    {error}
                  </div>
                ) : soilDevices.length > 0 ? (
                  soilDevices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDeviceSelect(d.id, '/soil')}
                      className="flex items-center justify-between text-xs font-semibold text-app-primary bg-emerald-500/5 hover:bg-emerald-500/10 p-2.5 rounded-lg transition-colors group text-left cursor-pointer"
                    >
                      <span className="truncate mr-2">{d.deviceName}</span>
                      <ChevronRight
                        size={16}
                        className="group-hover:translate-x-0.5 transition-transform flex-shrink-0"
                      />
                    </button>
                  ))
                ) : (
                  <div className="text-[11px] text-app-on-surface-variant p-2 text-center bg-app-surface-container/30 rounded-lg">
                    {tDevices('noDevicesFound')}
                  </div>
                )}
              </div>
            </div>

            {/* Water Quality Card */}
            <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 mb-3">
                  <Droplets size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface">
                  {tDevices('sensorWaterTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorWaterDesc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-app-outline-variant/20 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-app-on-surface-variant uppercase tracking-wider px-0.5">
                  {tDevices('devicesListTitle')}
                </span>
                {isLoading ? (
                  <div className="space-y-1.5 animate-pulse" data-testid="sensor-water-loading">
                    <div className="h-9 bg-app-surface-container/60 rounded-lg" />
                  </div>
                ) : error && devices.length === 0 ? (
                  <div className="text-[11px] text-app-error p-2 text-center bg-app-error/10 rounded-lg">
                    {error}
                  </div>
                ) : waterDevices.length > 0 ? (
                  waterDevices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDeviceSelect(d.id, '/water')}
                      className="flex items-center justify-between text-xs font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 p-2.5 rounded-lg transition-colors group text-left cursor-pointer"
                    >
                      <span className="truncate mr-2">{d.deviceName}</span>
                      <ChevronRight
                        size={16}
                        className="group-hover:translate-x-0.5 transition-transform flex-shrink-0"
                      />
                    </button>
                  ))
                ) : (
                  <div className="text-[11px] text-app-on-surface-variant p-2 text-center bg-app-surface-container/30 rounded-lg">
                    {tDevices('noDevicesFound')}
                  </div>
                )}
              </div>
            </div>

            {/* Water Tank Card */}
            <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 mb-3">
                  <Database size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-app-on-surface">
                  {tDevices('sensorControlsTitle')}
                </h3>
                <p className="text-[12px] text-app-on-surface-variant mt-1 leading-relaxed">
                  {tDevices('sensorControlsDesc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-app-outline-variant/20 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-app-on-surface-variant uppercase tracking-wider px-0.5">
                  {tDevices('devicesListTitle')}
                </span>
                {isLoading ? (
                  <div className="space-y-1.5 animate-pulse" data-testid="sensor-controls-loading">
                    <div className="h-9 bg-app-surface-container/60 rounded-lg" />
                  </div>
                ) : error && devices.length === 0 ? (
                  <div className="text-[11px] text-app-error p-2 text-center bg-app-error/10 rounded-lg">
                    {error}
                  </div>
                ) : controlDevices.length > 0 ? (
                  controlDevices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDeviceSelect(d.id, '/controls')}
                      className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 p-2.5 rounded-lg transition-colors group text-left cursor-pointer"
                    >
                      <span className="truncate mr-2">{d.deviceName}</span>
                      <ChevronRight
                        size={16}
                        className="group-hover:translate-x-0.5 transition-transform flex-shrink-0"
                      />
                    </button>
                  ))
                ) : (
                  <div className="text-[11px] text-app-on-surface-variant p-2 text-center bg-app-surface-container/30 rounded-lg">
                    {tDevices('noDevicesFound')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
