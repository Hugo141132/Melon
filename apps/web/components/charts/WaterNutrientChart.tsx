'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { BaseSeriesItem } from '@/hooks/useHistoricalMonitoring';
import { getCustomXTicks, formatTooltipDateTime } from './NPKChart';

export interface WaterNutrientChartProps {
  data?: BaseSeriesItem[];
  selectedMetric?: string;
  preset?: string;
  loading?: boolean;
  error?: string | null;
  selectedLocationKey?: string;
}

export function WaterChartTooltipContent({
  active,
  payload,
  label,
  metricLabel,
  metricUnit,
  preset,
  locale,
  tCommon,
}: any) {
  if (!active || !payload || payload.length === 0) return null;

  const firstItem = payload[0]?.payload as BaseSeriesItem | undefined;
  const rawTs = firstItem?.timestamp || firstItem?.timestampMs || label;
  const formattedTime = formatTooltipDateTime(rawTs, preset, locale);
  const readingId = firstItem?.readingId;

  return (
    <div
      className="bg-white/95 backdrop-blur-sm border border-app-outline-variant/60 rounded-xl p-3 shadow-md text-xs space-y-1.5 min-w-[150px]"
      data-testid="chart-custom-tooltip"
    >
      <div className="font-semibold text-app-on-surface flex items-center justify-between gap-2 border-b border-app-outline-variant/30 pb-1">
        <span>{formattedTime}</span>
        {readingId && (
          <span
            className="font-mono text-[10px] text-app-on-surface-variant bg-app-surface-container/60 px-1.5 py-0.5 rounded"
            title={String(readingId)}
          >
            ID: {String(readingId).slice(0, 8)}
          </span>
        )}
      </div>
      {payload.map((entry: any, idx: number) => {
        const val = entry.value;
        const displayVal =
          val !== null && val !== undefined
            ? `${val} ${entry.unit || metricUnit || ''}`.trim()
            : tCommon('unavailable');
        return (
          <div key={`entry-${idx}`} className="flex items-center justify-between gap-3">
            <span className="text-app-on-surface-variant flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              {entry.name || metricLabel}
            </span>
            <span className="font-bold text-app-on-surface font-mono">{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
}

const EMPTY_DATA: BaseSeriesItem[] = [];

export default function WaterNutrientChart({
  data = EMPTY_DATA,
  selectedMetric = 'ec',
  preset,
  loading = false,
  error = null,
  selectedLocationKey,
}: WaterNutrientChartProps) {
  const tWater = useTranslations('water');
  const tHistory = useTranslations('history');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [brushIndices, setBrushIndices] = useState<{ startIndex?: number; endIndex?: number }>({});

  // Reset zoom whenever data source, location, or preset changes
  useEffect(() => {
    setBrushIndices((prev) => {
      if (prev.startIndex === undefined && prev.endIndex === undefined) {
        return prev;
      }
      return {};
    });
  }, [data, selectedLocationKey, preset]);

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (typeof range?.startIndex === 'number' && typeof range?.endIndex === 'number') {
      setBrushIndices(range);
    }
  }, []);

  const visibleData = useMemo(() => {
    if (
      typeof brushIndices.startIndex === 'number' &&
      typeof brushIndices.endIndex === 'number' &&
      brushIndices.startIndex >= 0 &&
      brushIndices.endIndex < data.length &&
      (brushIndices.startIndex > 0 || brushIndices.endIndex < data.length - 1)
    ) {
      return data.slice(brushIndices.startIndex, brushIndices.endIndex + 1);
    }
    return data;
  }, [data, brushIndices]);

  const waterMetricConfig: Record<
    string,
    { label: string; unit: string; color: string; dataKey: string }
  > = {
    ec: { label: tWater('ecCardTitle'), unit: 'µS/cm', color: '#0d631b', dataKey: 'ec' },
    ph: { label: tWater('phLevelTitle'), unit: '', color: '#884200', dataKey: 'ph' },
    tds: { label: tWater('tdsCardTitle'), unit: 'ppm', color: '#0284c7', dataKey: 'tds' },
  };

  const active = waterMetricConfig[selectedMetric] || waterMetricConfig.ec;

  const { ticks, formatTick } = useMemo(() => {
    return getCustomXTicks(visibleData, preset, locale);
  }, [visibleData, preset, locale]);

  const timeDomain = useMemo<[number, number] | ['dataMin', 'dataMax']>(() => {
    if (!visibleData || visibleData.length === 0) return ['dataMin', 'dataMax'];
    const getMs = (item: BaseSeriesItem): number =>
      typeof item.timestampMs === 'number' ? item.timestampMs : new Date(item.timestamp).getTime();
    const tFirst = getMs(visibleData[0]);
    const tLast = getMs(visibleData[visibleData.length - 1]);
    if (tFirst === tLast && !isNaN(tFirst)) {
      // Single-point or equal-timestamp dataset: add +/- 1 hour padding so domain is non-degenerate
      return [tFirst - 3600000, tLast + 3600000];
    }
    if (
      typeof brushIndices.startIndex === 'number' &&
      typeof brushIndices.endIndex === 'number' &&
      (brushIndices.startIndex > 0 || brushIndices.endIndex < data.length - 1)
    ) {
      return [tFirst, tLast];
    }
    return ['dataMin', 'dataMax'];
  }, [visibleData, brushIndices, data.length]);

  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] sm:text-[20px] leading-7 font-bold text-app-on-surface">
          {tWater('metricHistoryTitle', { metric: active.label })}
        </h3>
      </div>

      {loading ? (
        <div className="h-40 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg animate-pulse">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {tHistory('loadingHistory')}
          </span>
        </div>
      ) : error ? (
        <div className="h-40 w-full flex items-center justify-center bg-red-500/5 rounded-lg border border-red-500/20 p-4 text-center">
          <span className="text-[13px] text-red-600 font-medium">{error}</span>
        </div>
      ) : selectedLocationKey !== undefined && !selectedLocationKey ? (
        <div className="h-40 w-full flex flex-col items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface font-medium">
            {tHistory('chartSelectLocation')}
          </span>
          <span className="text-[11px] text-app-on-surface-variant mt-1 max-w-md">
            {tHistory('chartSelectLocationHint')}
          </span>
        </div>
      ) : data.length === 0 ? (
        <div className="h-40 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {selectedLocationKey ? tHistory('chartNoData') : tHistory('noData')}
          </span>
        </div>
      ) : (
        <div className={data.length > 1 ? 'h-48 sm:h-56' : 'h-40 sm:h-48'}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradWater-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={active.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={active.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
              <XAxis
                dataKey="timestampMs"
                type="number"
                scale="time"
                domain={timeDomain}
                ticks={ticks.length > 0 ? ticks : undefined}
                tickFormatter={formatTick}
                interval="preserveStartEnd"
                minTickGap={25}
                tick={{ fontSize: 11, fill: '#40493d' }}
                padding={{ left: 16, right: 16 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#40493d' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={(props: any) => (
                  <WaterChartTooltipContent
                    {...props}
                    metricLabel={active.label}
                    metricUnit={active.unit}
                    preset={preset}
                    locale={locale}
                    tCommon={tCommon}
                  />
                )}
              />
              <Area
                type="linear"
                dataKey={active.dataKey}
                name={active.label}
                stroke={active.color}
                strokeWidth={2}
                fill={`url(#gradWater-${selectedMetric})`}
                connectNulls={false}
                dot={{
                  r: 3,
                  fill: active.color,
                  stroke: '#ffffff',
                  strokeWidth: 1,
                }}
                activeDot={{
                  r: 6,
                  fill: active.color,
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
              {data.length > 1 && (
                <Brush
                  dataKey="timestampMs"
                  height={24}
                  stroke={active.color}
                  fill="#f8fafc"
                  tickFormatter={formatTick}
                  travellerWidth={10}
                  onChange={handleBrushChange}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
