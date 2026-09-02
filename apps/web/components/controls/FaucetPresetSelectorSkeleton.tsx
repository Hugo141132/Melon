import React from 'react';
import { cn } from '@/lib/utils';

export interface FaucetPresetSelectorSkeletonProps {
  className?: string;
}

export function FaucetPresetSelectorSkeleton({ className }: FaucetPresetSelectorSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-app-surface-container-lowest p-6 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg space-y-6 animate-pulse',
        className
      )}
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
    </div>
  );
}

export default FaucetPresetSelectorSkeleton;
