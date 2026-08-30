'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { BaseSeriesItem } from '@/hooks/useHistoricalMonitoring';
import { getCustomXTicks, formatDayMonth } from './NPKChart';

export interface WaterNutrientChartProps {
  data?: BaseSeriesItem[];
  selectedMetric?: string;
  preset?: string;
  loading?: boolean;
  error?: string | null;
}

export default function WaterNutrientChart({
  data = [],
  selectedMetric = 'ec',
  preset,
  loading = false,
  error = null,
}: WaterNutrientChartProps) {
  const tWater = useTranslations('water');
  const tHistory = useTranslations('history');
  const tCommon = useTranslations('common');
  const locale = useLocale();

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
    return getCustomXTicks(data, preset, locale);
  }, [data, preset, locale]);

  const cleanLabelFormatter = (label: any, payload: any[]) => {
    if (payload && payload.length > 0 && payload[0]?.payload?.timestamp) {
      const d = new Date(payload[0].payload.timestamp);
      const dateStr = formatDayMonth(d, locale);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return preset === '24h' ? `${hh}:${mm}` : `${dateStr} ${hh}:${mm}`;
    }
    return typeof label === 'string' ? label.replace(/,/g, '').replace(/\./g, '').trim() : label;
  };

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
      ) : data.length === 0 ? (
        <div className="h-40 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {tHistory('noData')}
          </span>
        </div>
      ) : (
        <div className="h-40 sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradWater-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={active.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={active.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
              <XAxis
                dataKey="time"
                ticks={ticks.length > 0 ? ticks : undefined}
                tickFormatter={formatTick}
                interval={0}
                tick={{ fontSize: 11, fill: '#40493d' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#40493d' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #bfcaba',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                labelFormatter={cleanLabelFormatter}
                formatter={(value: any) => [
                  value !== null && value !== undefined
                    ? `${value} ${active.unit}`.trim()
                    : tCommon('unavailable'),
                  active.label,
                ]}
              />
              <Area
                type="monotone"
                dataKey={active.dataKey}
                name={active.label}
                stroke={active.color}
                strokeWidth={2.5}
                fill={`url(#gradWater-${selectedMetric})`}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 5, fill: active.color }}
                strokeLinecap="round"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
