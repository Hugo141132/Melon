'use client';

import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import FaucetControlPanel from '@/components/controls/FaucetControlPanel';
import WaterTankMonitoringCard from '@/components/monitoring/WaterTankMonitoringCard';
import DeviceAccessForbidden from '@/components/navigation/DeviceAccessForbidden';
import { useDeviceContext } from '@/context/DeviceContext';

export default function ControlsPage() {
  const { isRevoked, revokedDeviceId, revokedDeviceName } = useDeviceContext();

  if (isRevoked) {
    return (
      <DeviceAccessForbidden
        deviceId={revokedDeviceId}
        deviceName={revokedDeviceName}
        deviceType="WATER_TANK_NODE"
      />
    );
  }

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
