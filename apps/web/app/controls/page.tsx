'use client';

import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import FaucetControlPanel from '@/components/controls/FaucetControlPanel';
import { Sliders, Droplets } from 'lucide-react';

export default function ControlsPage() {
  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-6">
        {/* Page Title & Context Banner */}
        <section className="bg-app-surface-container-lowest p-5 rounded-2xl soft-elevation-lg border border-app-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary flex-shrink-0">
              <Droplets size={26} />
            </div>
            <div>
              <h1 className="text-[22px] leading-7 font-bold text-app-primary tracking-tight">
                Kontrol Kran Air & Presets
              </h1>
              <p className="text-[13px] text-app-on-surface-variant">
                Pemberian dosis air otomatis per fase pertumbuhan tanaman melon
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-app-primary/5 px-3 py-1.5 rounded-xl border border-app-primary/20 text-xs font-semibold text-app-primary self-start sm:self-auto">
            <Sliders size={14} />
            <span>Preset Dosis: 300 / 1000 / 1500 mL</span>
          </div>
        </section>

        {/* Faucet Control Dashboard Panel */}
        <FaucetControlPanel />
      </main>

      <BottomNav />
    </div>
  );
}
