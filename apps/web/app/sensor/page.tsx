'use client';

import React from 'react';
import Link from 'next/link';
import TopAppBar from '@/components/navigation/TopAppBar';
import { useDeviceContext } from '@/context/DeviceContext';
import { Radio, Sprout, Droplets, Sliders, ArrowRight } from 'lucide-react';
import { formatDeviceDisplayName } from '@/lib/utils';

export default function SensorPage() {
  const { selectedDevice } = useDeviceContext();

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto space-y-6">
        {/* Introductory Hero Empty State */}
        <section className="bg-app-surface-container-lowest rounded-2xl p-6 sm:p-8 soft-elevation-lg border border-app-outline-variant/30 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-app-primary/10 text-app-primary flex items-center justify-center mx-auto shadow-xs">
            <Radio size={32} strokeWidth={2.2} />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h1 className="text-[22px] sm:text-[24px] leading-8 font-bold text-app-on-surface">
              Pemantauan & Manajemen Sensor
            </h1>
            <p className="text-[14px] leading-6 text-app-on-surface-variant">
              Silakan pilih salah satu node perangkat sensor pada pemilih perangkat di atas untuk
              melihat telemetry dan status pemantauan secara real-time.
            </p>
          </div>

          {selectedDevice && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Perangkat Terpilih: {formatDeviceDisplayName(selectedDevice)}
            </div>
          )}
        </section>

        {/* Quick Route Cards */}
        <section className="space-y-3 animate-fade-in">
          <h2 className="text-[16px] leading-6 font-bold text-app-on-surface">
            Kategori Monitoring Sensor
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/soil"
              className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 hover:border-app-primary/40 soft-elevation transition-all active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Sprout size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-app-on-surface-variant group-hover:text-app-primary group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="text-[15px] font-bold text-app-on-surface mb-1">Sensor Tanah</h3>
              <p className="text-[12px] leading-5 text-app-on-surface-variant">
                Nitrogen, Fosfor, Kalium, Suhu, Kelembapan, pH, EC.
              </p>
            </Link>

            <Link
              href="/water"
              className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 hover:border-app-primary/40 soft-elevation transition-all active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Droplets size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-app-on-surface-variant group-hover:text-app-primary group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="text-[15px] font-bold text-app-on-surface mb-1">Kualitas Air</h3>
              <p className="text-[12px] leading-5 text-app-on-surface-variant">
                TDS (ppm), EC (mS/cm), dan derajat keasaman (pH).
              </p>
            </Link>

            <Link
              href="/controls"
              className="bg-app-surface-container-lowest rounded-xl p-5 border border-app-outline-variant/20 hover:border-app-primary/40 soft-elevation transition-all active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sliders size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-app-on-surface-variant group-hover:text-app-primary group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="text-[15px] font-bold text-app-on-surface mb-1">Tangki Air & Kran</h3>
              <p className="text-[12px] leading-5 text-app-on-surface-variant">
                Volume Tangki (L), Debit Air (m³/h), Preset Kran.
              </p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
