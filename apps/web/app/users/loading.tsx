import React from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { Users, Search } from 'lucide-react';

export default function UsersLoading() {
  return (
    <div
      className="bg-app-surface text-app-on-surface min-h-dvh pb-24"
      data-testid="users-loading-shell"
    >
      <TopAppBar />

      <main className="pt-20 px-4 max-w-5xl mx-auto w-full space-y-5">
        {/* Header Skeleton */}
        <section
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-app-surface-container-lowest p-5 rounded-2xl border border-app-outline-variant/30 soft-elevation animate-pulse"
          data-testid="users-loading-header"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
              <Users size={24} />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-app-surface-container rounded" />
              <div className="h-4 w-72 bg-app-surface-container rounded" />
            </div>
          </div>
          <div className="h-9 w-28 bg-app-surface-container rounded-xl self-start sm:self-auto" />
        </section>

        {/* Controls & Filters Skeleton */}
        <div
          className="bg-app-surface-container-lowest p-4 rounded-2xl border border-app-outline-variant/30 soft-elevation flex flex-col md:flex-row gap-3 animate-pulse"
          data-testid="users-loading-filters"
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

        {/* Users Table Skeleton */}
        <div
          className="bg-app-surface-container-lowest rounded-2xl border border-app-outline-variant/30 soft-elevation overflow-hidden animate-pulse"
          data-testid="users-loading-table"
        >
          <div className="p-4 border-b border-app-outline-variant/20 flex items-center justify-between">
            <div className="h-5 w-32 bg-app-surface-container rounded" />
            <div className="h-5 w-24 bg-app-surface-container rounded" />
          </div>

          <div className="divide-y divide-app-outline-variant/10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-app-surface-container flex-shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 bg-app-surface-container rounded" />
                    <div className="h-3 w-48 bg-app-surface-container rounded" />
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-4">
                  <div className="h-6 w-20 bg-app-surface-container rounded-full" />
                  <div className="h-6 w-16 bg-app-surface-container rounded-full" />
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <div className="h-8 w-8 bg-app-surface-container rounded-lg" />
                  <div className="h-8 w-8 bg-app-surface-container rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
