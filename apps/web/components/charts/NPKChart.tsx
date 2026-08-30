'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
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

const NPK_COLORS = {
  n: '#0d631b',
  p: '#884200',
  k: '#476800',
};

export interface NPKChartProps {
  data?: BaseSeriesItem[];
  selectedMetric?: string;
  preset?: string;
  loading?: boolean;
  error?: string | null;
}

export function formatDayMonth(date: Date, locale: string = 'id'): string {
  const day = date.getDate();
  const intlLocale = locale === 'en' ? 'en-US' : 'id-ID';
  const month = date
    .toLocaleDateString(intlLocale, { month: 'short' })
    .replace(/,/g, '')
    .replace(/\./g, '')
    .trim();
  return `${day} ${month}`;
}

export function getCustomXTicks(
  data: BaseSeriesItem[],
  preset?: string,
  locale: string = 'id'
): {
  ticks: string[];
  formatTick: (value: string) => string;
} {
  if (!data || data.length === 0) {
    return { ticks: [], formatTick: (v: string) => v };
  }

  if (data.length <= 1) {
    return { ticks: [data[0].time], formatTick: (v: string) => v };
  }

  const firstTime = new Date(data[0].timestamp).getTime();
  const lastTime = new Date(data[data.length - 1].timestamp).getTime();
  const spanHours = (lastTime - firstTime) / (1000 * 60 * 60);

  const is24h = preset === '24h' || (spanHours > 0 && spanHours <= 24);
  const is7d = preset === '7d' || (spanHours > 24 && spanHours <= 8 * 24);

  const tickLabels = new Map<string, string>();

  if (is24h) {
    // 24 Hours: show ~5-8 readable time labels without displaying every single hour
    if (data.length <= 8) {
      for (const d of data) {
        const itemDate = new Date(d.timestamp);
        const hh = String(itemDate.getHours()).padStart(2, '0');
        const mm = String(itemDate.getMinutes()).padStart(2, '0');
        tickLabels.set(d.time, `${hh}:${mm}`);
      }
      return {
        ticks: data.map((d) => d.time),
        formatTick: (v: string) => tickLabels.get(v) || v,
      };
    }

    const step = Math.max(1, Math.floor(data.length / 6));
    const selectedTicks: string[] = [];
    for (let i = 0; i < data.length; i += step) {
      const item = data[i];
      selectedTicks.push(item.time);
      const itemDate = new Date(item.timestamp);
      const hh = String(itemDate.getHours()).padStart(2, '0');
      const mm = String(itemDate.getMinutes()).padStart(2, '0');
      tickLabels.set(item.time, `${hh}:${mm}`);
    }
    return {
      ticks: selectedTicks,
      formatTick: (v: string) => tickLabels.get(v) || v,
    };
  }

  if (is7d) {
    // 7 Days: group by calendar date, display with comfortable spacing (4-5 labels to prevent overlap)
    const dayGroups = new Map<string, BaseSeriesItem>();
    for (const item of data) {
      const d = new Date(item.timestamp);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!dayGroups.has(dateKey)) {
        dayGroups.set(dateKey, item);
      }
    }

    const distinctDays = Array.from(dayGroups.values());
    const selectedTicks: string[] = [];

    // Step of 2 when > 4 days ensures 4 clean labels with plenty of margin, completely eliminating label overlap
    const step = distinctDays.length > 4 ? 2 : 1;
    for (let i = 0; i < distinctDays.length; i += step) {
      const item = distinctDays[i];
      selectedTicks.push(item.time);
      tickLabels.set(item.time, formatDayMonth(new Date(item.timestamp), locale));
    }

    // Include the final day if not yet included
    const lastDayItem = distinctDays[distinctDays.length - 1];
    if (!selectedTicks.includes(lastDayItem.time)) {
      selectedTicks.push(lastDayItem.time);
      tickLabels.set(lastDayItem.time, formatDayMonth(new Date(lastDayItem.timestamp), locale));
    }

    return {
      ticks: selectedTicks,
      formatTick: (v: string) => {
        if (tickLabels.has(v)) return tickLabels.get(v)!;
        const parts = v.replace(/,/g, '').replace(/\./g, '').split(' ');
        return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : v;
      },
    };
  }

  // 30 Days: group by day, display ~5-7 date labels with appropriate spacing
  const dayGroups = new Map<string, BaseSeriesItem>();
  for (const item of data) {
    const d = new Date(item.timestamp);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!dayGroups.has(dateKey)) {
      dayGroups.set(dateKey, item);
    }
  }

  const distinctDays = Array.from(dayGroups.values());
  const step = Math.ceil(distinctDays.length / 6);
  const selectedTicks: string[] = [];
  for (let i = 0; i < distinctDays.length; i += step) {
    const item = distinctDays[i];
    selectedTicks.push(item.time);
    tickLabels.set(item.time, formatDayMonth(new Date(item.timestamp), locale));
  }

  const lastDayItem = distinctDays[distinctDays.length - 1];
  if (!selectedTicks.includes(lastDayItem.time)) {
    selectedTicks.push(lastDayItem.time);
    tickLabels.set(lastDayItem.time, formatDayMonth(new Date(lastDayItem.timestamp), locale));
  }

  return {
    ticks: selectedTicks,
    formatTick: (v: string) => {
      if (tickLabels.has(v)) return tickLabels.get(v)!;
      const parts = v.replace(/,/g, '').replace(/\./g, '').split(' ');
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : v;
    },
  };
}

export default function NPKChart({
  data = [],
  selectedMetric = 'npk',
  preset,
  loading = false,
  error = null,
}: NPKChartProps) {
  const tSoil = useTranslations('soil');
  const tHistory = useTranslations('history');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const singleMetricConfig: Record<
    string,
    { label: string; unit: string; color: string; dataKey: string }
  > = {
    temperature: {
      label: tSoil('temperature'),
      unit: '°C',
      color: '#d97706',
      dataKey: 'temperature',
    },
    moisture: { label: tSoil('moisture'), unit: '%', color: '#0284c7', dataKey: 'moisture' },
    ph: { label: tSoil('ph'), unit: '', color: '#884200', dataKey: 'ph' },
    ec: { label: tSoil('ec'), unit: 'µS/cm', color: '#0d631b', dataKey: 'ec' },
  };

  const isSingleMetric = selectedMetric !== 'npk';
  const singleConfig = singleMetricConfig[selectedMetric];

  const titleText = isSingleMetric
    ? tSoil('metricHistoryTitle', { metric: singleConfig?.label || selectedMetric })
    : tSoil('npkTrend');

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] sm:text-[20px] leading-7 font-bold text-app-on-surface">
          {titleText}
        </h3>
        {!isSingleMetric && (
          <div className="flex gap-3">
            {[
              { key: 'N', color: NPK_COLORS.n },
              { key: 'P', color: NPK_COLORS.p },
              { key: 'K', color: NPK_COLORS.k },
            ].map(({ key, color }) => (
              <div key={key} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[11px] font-semibold text-app-on-surface-variant">{key}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-44 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg animate-pulse">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {tHistory('loadingHistory')}
          </span>
        </div>
      ) : error ? (
        <div className="h-44 w-full flex items-center justify-center bg-red-500/5 rounded-lg border border-red-500/20 p-4 text-center">
          <span className="text-[13px] text-red-600 font-medium">{error}</span>
        </div>
      ) : data.length === 0 ? (
        <div className="h-44 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {tHistory('noData')}
          </span>
        </div>
      ) : (
        <div className="h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            {isSingleMetric && singleConfig ? (
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={singleConfig.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={singleConfig.color} stopOpacity={0} />
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
                      ? `${value} ${singleConfig.unit}`.trim()
                      : tCommon('unavailable'),
                    singleConfig.label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={singleConfig.dataKey}
                  name={singleConfig.label}
                  stroke={singleConfig.color}
                  strokeWidth={2.5}
                  fill={`url(#grad-${selectedMetric})`}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5, fill: singleConfig.color }}
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
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
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#40493d' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #bfcaba',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  labelFormatter={cleanLabelFormatter}
                  formatter={(value: any, name: any) => [
                    value !== null && value !== undefined
                      ? `${value} mg/kg`
                      : tCommon('unavailable'),
                    name,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="n"
                  name={tSoil('nitrogen')}
                  stroke={NPK_COLORS.n}
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5, fill: NPK_COLORS.n }}
                  strokeLinecap="round"
                />
                <Line
                  type="monotone"
                  dataKey="p"
                  name={tSoil('phosphorus')}
                  stroke={NPK_COLORS.p}
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5, fill: NPK_COLORS.p }}
                  strokeLinecap="round"
                />
                <Line
                  type="monotone"
                  dataKey="k"
                  name={tSoil('potassium')}
                  stroke={NPK_COLORS.k}
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5, fill: NPK_COLORS.k }}
                  strokeLinecap="round"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
