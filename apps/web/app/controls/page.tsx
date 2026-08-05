'use client';

import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import FaucetControlPanel from '@/components/controls/FaucetControlPanel';
import WaterTankMonitoringCard from '@/components/monitoring/WaterTankMonitoringCard';

export default function ControlsPage() {
  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-6">
        {/* Tank Monitoring Card */}
        <WaterTankMonitoringCard />

        {/* Faucet Control Dashboard Panel */}
        <FaucetControlPanel />
      </main>
    </div>
  );
}
