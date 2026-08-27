import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';

export default function ControlsLoading() {
  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-10">
      <TopAppBar showDeviceSelector={true} />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-6">
        {/* 1. Water Tank Monitoring Card Structural Skeleton */}
        <section className="space-y-4" data-testid="controls-loading-tank">
          {/* Header Banner Skeleton */}
          <div className="bg-app-surface-container-lowest rounded-2xl p-5 border border-app-outline-variant/30 soft-elevation-lg flex flex-wrap items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-app-surface-container flex-shrink-0" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-36 bg-app-surface-container rounded" />
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-app-surface-container text-app-on-surface-variant">
                    WATER_TANK_NODE
                  </span>
                </div>
                <div className="h-3 w-28 bg-app-surface-container rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-20 bg-app-surface-container rounded-full" />
              <div className="w-8 h-8 rounded-xl border border-app-outline-variant/30 bg-app-surface-container/40" />
            </div>
          </div>

          {/* 2-col Metric Card Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tank Volume Skeleton */}
            <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between animate-pulse">
              <div>
                <div className="h-4 w-32 bg-app-surface-container rounded mb-2" />
                <div className="flex items-baseline gap-1">
                  <div className="h-9 w-20 bg-app-surface-container rounded my-0.5" />
                  <span className="text-[12px] text-app-on-surface-variant">L</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-app-surface-container" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-bold text-app-on-surface-variant">0L</span>
                  <span className="text-[10px] font-bold text-app-on-surface-variant">600L</span>
                </div>
              </div>
            </div>

            {/* Flow Rate Skeleton */}
            <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between animate-pulse">
              <div>
                <div className="h-4 w-24 bg-app-surface-container rounded mb-2" />
                <div className="flex items-baseline gap-1">
                  <div className="h-9 w-16 bg-app-surface-container rounded my-0.5" />
                  <span className="text-[12px] text-app-on-surface-variant">m³/h</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1">
                <div className="h-4 w-24 bg-app-surface-container rounded" />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Faucet Preset Selector Card Skeleton */}
        <section
          className="bg-app-surface-container-lowest p-6 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg space-y-6 animate-pulse"
          data-testid="controls-loading-presets"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="h-6 w-44 bg-app-surface-container rounded mb-1" />
              <div className="h-4 w-64 bg-app-surface-container rounded" />
            </div>
            <div className="h-7 w-32 bg-app-surface-container rounded-xl self-start sm:self-auto" />
          </div>

          {/* Plant Count Stepper */}
          <div className="bg-app-surface-container/30 p-4 rounded-2xl border border-app-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="h-4 w-28 bg-app-surface-container rounded mb-1" />
              <div className="h-3 w-48 bg-app-surface-container rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-app-surface-container" />
              <div className="w-14 h-9 rounded-xl bg-app-surface-container" />
              <div className="w-9 h-9 rounded-xl bg-app-surface-container" />
            </div>
          </div>

          {/* 3 Preset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-app-surface-container/20 rounded-xl p-4 border border-app-outline-variant/20 flex flex-col justify-between h-36"
              >
                <div>
                  <div className="h-4 w-16 bg-app-surface-container rounded mb-1" />
                  <div className="h-3 w-28 bg-app-surface-container rounded" />
                </div>
                <div className="h-9 w-full bg-app-surface-container rounded-xl" />
              </div>
            ))}
          </div>

          {/* Manual Controls Skeleton */}
          <div className="pt-2 border-t border-app-outline-variant/20 flex flex-wrap gap-3">
            <div className="h-10 w-36 bg-app-surface-container rounded-xl" />
            <div className="h-10 w-36 bg-app-surface-container rounded-xl" />
          </div>
        </section>

        {/* 3. Faucet History Table Card Skeleton */}
        <section
          className="bg-app-surface-container-lowest p-5 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg space-y-4 animate-pulse"
          data-testid="controls-loading-history"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-app-surface-container" />
              <div>
                <div className="h-5 w-40 bg-app-surface-container rounded mb-1" />
                <div className="h-3 w-56 bg-app-surface-container rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-32 bg-app-surface-container rounded-xl" />
              <div className="w-8 h-8 rounded-xl bg-app-surface-container" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-app-outline-variant/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-app-surface-container-low/60 border-b border-app-outline-variant/20">
                  <th className="p-3">
                    <div className="h-3 w-20 bg-app-surface-container rounded" />
                  </th>
                  <th className="p-3">
                    <div className="h-3 w-16 bg-app-surface-container rounded" />
                  </th>
                  <th className="p-3">
                    <div className="h-3 w-14 bg-app-surface-container rounded" />
                  </th>
                  <th className="p-3">
                    <div className="h-3 w-20 bg-app-surface-container rounded" />
                  </th>
                  <th className="p-3">
                    <div className="h-3 w-12 bg-app-surface-container rounded" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-outline-variant/10">
                {[1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="p-3">
                      <div className="h-3 w-24 bg-app-surface-container rounded" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-16 bg-app-surface-container rounded" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-20 bg-app-surface-container rounded" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-24 bg-app-surface-container rounded" />
                    </td>
                    <td className="p-3">
                      <div className="h-3 w-16 bg-app-surface-container rounded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
