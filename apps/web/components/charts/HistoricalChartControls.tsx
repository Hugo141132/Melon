'use client';

import React from 'react';
import { DateRangePreset, DomainType } from '@/hooks/useHistoricalMonitoring';

export interface MetricOption {
  key: string;
  label: string;
  unit?: string;
}

export interface HistoricalChartControlsProps {
  domain: DomainType;
  selectedMetric: string;
  onSelectMetric: (metric: string) => void;
  preset: DateRangePreset;
  onSelectPreset: (preset: DateRangePreset) => void;
  customFrom: string;
  onCustomFromChange: (val: string) => void;
  customTo: string;
  onCustomToChange: (val: string) => void;
  dateRangeError?: string | null;
}

const SOIL_METRICS: MetricOption[] = [
  { key: 'npk', label: 'NPK' },
  { key: 'temperature', label: 'Suhu', unit: '°C' },
  { key: 'moisture', label: 'Kelembapan', unit: '%' },
  { key: 'ph', label: 'pH' },
  { key: 'ec', label: 'EC', unit: 'µS/cm' },
];

const WATER_METRICS: MetricOption[] = [
  { key: 'ec', label: 'EC', unit: 'µS/cm' },
  { key: 'ph', label: 'pH' },
  { key: 'tds', label: 'TDS', unit: 'ppm' },
];

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: '24h', label: '24 Jam' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'custom', label: 'Kustom' },
];

export default function HistoricalChartControls({
  domain,
  selectedMetric,
  onSelectMetric,
  preset,
  onSelectPreset,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  dateRangeError,
}: HistoricalChartControlsProps) {
  const metrics = domain === 'soil' ? SOIL_METRICS : WATER_METRICS;

  return (
    <div className="space-y-3 mb-4">
      {/* Metrics & Date Presets row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Metric Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {metrics.map((m) => {
            const isActive = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelectMetric(m.key)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-app-primary text-white shadow-sm'
                    : 'bg-app-surface-container text-app-on-surface-variant hover:bg-app-surface-container-high'
                }`}
              >
                {m.label} {m.unit ? `(${m.unit})` : ''}
              </button>
            );
          })}
        </div>

        {/* Date Range Preset Pills */}
        <div className="flex items-center gap-1 bg-app-surface-container/60 p-1 rounded-lg">
          {PRESETS.map((p) => {
            const isActive = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPreset(p.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-app-surface-container-lowest text-app-primary shadow-xs font-bold'
                    : 'text-app-on-surface-variant hover:text-app-on-surface'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Inputs */}
      {preset === 'custom' && (
        <div className="bg-app-surface-container/30 p-3 rounded-lg flex flex-wrap items-center gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            <label htmlFor="custom-from-input" className="text-app-on-surface-variant font-medium">
              Dari:
            </label>
            <input
              id="custom-from-input"
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="bg-app-surface-container-lowest border border-app-outline-variant/50 rounded px-2 py-1 text-app-on-surface text-[12px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-to-input" className="text-app-on-surface-variant font-medium">
              Sampai:
            </label>
            <input
              id="custom-to-input"
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="bg-app-surface-container-lowest border border-app-outline-variant/50 rounded px-2 py-1 text-app-on-surface text-[12px]"
            />
          </div>
          <span className="text-[11px] text-app-on-surface-variant">
            (Maks. 31 hari per DEC-MON-087)
          </span>
        </div>
      )}

      {/* Date Range Validation Error */}
      {dateRangeError && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 text-[12px] font-medium">
          {dateRangeError}
        </div>
      )}
    </div>
  );
}
