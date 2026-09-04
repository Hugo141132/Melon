import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { Cpu, Search } from 'lucide-react';

export default function DevicesLoading() {
  return (
    <div
      className="bg-app-surface text-app-on-surface min-h-dvh pb-24"
      data-testid="devices-loading-shell"
    >
      <TopAppBar />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-5">
        {/* Header Skeleton */}
        <section
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-app-surface-container-lowest p-5 rounded-xl soft-elevation-lg border border-app-outline-variant/30 animate-pulse"
          data-testid="devices-loading-header"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
              <Cpu size={26} />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-app-surface-container rounded" />
              <div className="h-4 w-72 bg-app-surface-container rounded" />
            </div>
          </div>
        </section>

        {/* Controls & Filters Skeleton */}
        <div
          className="bg-app-surface-container-lowest p-4 rounded-xl soft-elevation border border-app-outline-variant/20 flex flex-col md:flex-row gap-3 animate-pulse"
          data-testid="devices-loading-filters"
        >
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-outline"
            />
            <div className="w-full h-10 bg-app-surface border border-app-outline-variant/40 rounded-xl" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-10 w-36 bg-app-surface border border-app-outline-variant/40 rounded-xl" />
            <div className="h-10 w-36 bg-app-surface border border-app-outline-variant/40 rounded-xl" />
          </div>
        </div>

        {/* Device Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="devices-loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-app-surface-container-lowest p-5 rounded-xl border border-app-outline-variant/20 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-app-surface-container rounded w-28" />
                <div className="h-5 bg-app-surface-container rounded-full w-16" />
              </div>
              <div className="h-6 bg-app-surface-container rounded w-3/4" />
              <div className="space-y-2 pt-2 border-t border-app-outline-variant/10">
                <div className="h-3 bg-app-surface-container rounded w-1/2" />
                <div className="h-3 bg-app-surface-container rounded w-2/3" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-5 bg-app-surface-container rounded w-20" />
                <div className="h-5 bg-app-surface-container rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
