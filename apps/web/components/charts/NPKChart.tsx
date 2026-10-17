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
  selectedLocationKey?: string;
}

export function formatDayMonth(date: Date, locale: string = 'id', timeZone?: string): string {
  const intlLocale = locale === 'en' ? 'en-US' : 'id-ID';
  const tz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Asia/Jakarta') ||
    'Asia/Jakarta';
  try {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
      day: 'numeric',
      month: 'short',
      timeZone: tz,
    });
    const parts = formatter.formatToParts(date);
    const day = parts.find((p) => p.type === 'day')?.value ?? date.getDate().toString();
    const month =
      parts
        .find((p) => p.type === 'month')
        ?.value.replace(/,/g, '')
        .replace(/\./g, '') ?? '';
    return `${day} ${month}`.trim();
  } catch {
    const day = date.getDate();
    const month = date
      .toLocaleDateString(intlLocale, { month: 'short' })
      .replace(/,/g, '')
      .replace(/\./g, '')
      .trim();
    return `${day} ${month}`;
  }
}

export function getCustomXTicks(
  data: BaseSeriesItem[],
  preset?: string,
  locale: string = 'id',
  timeZone?: string
): {
  ticks: number[];
  formatTick: (value: number | string) => string;
} {
  if (!data || data.length === 0) {
    return { ticks: [], formatTick: (v: number | string) => String(v) };
  }

  const getMs = (item: BaseSeriesItem): number => {
    if (typeof item.timestampMs === 'number') return item.timestampMs;
    const t = new Date(item.timestamp).getTime();
    return isNaN(t) ? 0 : t;
  };

  if (data.length <= 1) {
    const t0 = getMs(data[0]);
    return {
      ticks: [t0],
      formatTick: (v: number | string) => {
        const d = new Date(Number(v));
        return isNaN(d.getTime()) ? String(v) : formatDayMonth(d, locale, timeZone);
      },
    };
  }

  const tz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Asia/Jakarta') ||
    'Asia/Jakarta';

  const firstTime = getMs(data[0]);
  const lastTime = getMs(data[data.length - 1]);
  const spanHours = (lastTime - firstTime) / (1000 * 60 * 60);

  const is24h = preset === '24h' || (spanHours > 0 && spanHours <= 24);
  const is7d = preset === '7d' || (spanHours > 24 && spanHours <= 8 * 24);

  const tickLabels = new Map<number, string>();
  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  });

  if (is24h) {
    // 24 Hours: show ~5-8 evenly-spaced readable time labels without displaying every single point
    if (data.length <= 8) {
      for (const d of data) {
        const ms = getMs(d);
        tickLabels.set(ms, timeFormatter.format(new Date(ms)).replace(/\./g, ':'));
      }
      return {
        ticks: data.map(getMs),
        formatTick: (v: number | string) => {
          const num = Number(v);
          if (tickLabels.has(num)) return tickLabels.get(num)!;
          const d = new Date(num);
          return isNaN(d.getTime()) ? String(v) : timeFormatter.format(d).replace(/\./g, ':');
        },
      };
    }

    const targetCount = 6;
    const selectedTicks: number[] = [];
    const chosenIndices = new Set<number>();

    for (let k = 0; k < targetCount; k++) {
      const idx = Math.round((k * (data.length - 1)) / (targetCount - 1));
      chosenIndices.add(idx);
    }

    for (const idx of Array.from(chosenIndices).sort((a, b) => a - b)) {
      const item = data[idx];
      const ms = getMs(item);
      selectedTicks.push(ms);
      tickLabels.set(ms, timeFormatter.format(new Date(ms)).replace(/\./g, ':'));
    }

    return {
      ticks: selectedTicks,
      formatTick: (v: number | string) => {
        const num = Number(v);
        if (tickLabels.has(num)) return tickLabels.get(num)!;
        const d = new Date(num);
        return isNaN(d.getTime()) ? String(v) : timeFormatter.format(d).replace(/\./g, ':');
      },
    };
  }

  if (is7d) {
    // 7 Days: group by calendar date, display 4-5 evenly distributed labels preventing overlap
    const dayGroups = new Map<string, BaseSeriesItem>();
    for (const item of data) {
      const ms = getMs(item);
      const d = new Date(ms);
      const dateKey = dayKeyFormatter.format(d);
      if (!dayGroups.has(dateKey)) {
        dayGroups.set(dateKey, item);
      }
    }

    const distinctDays = Array.from(dayGroups.values());
    if (distinctDays.length <= 4) {
      const ticks = distinctDays.map(getMs);
      for (const d of distinctDays) {
        const ms = getMs(d);
        tickLabels.set(ms, formatDayMonth(new Date(ms), locale, tz));
      }
      return {
        ticks,
        formatTick: (v: number | string) => {
          const num = Number(v);
          if (tickLabels.has(num)) return tickLabels.get(num)!;
          const d = new Date(num);
          return isNaN(d.getTime()) ? String(v) : formatDayMonth(d, locale, tz);
        },
      };
    }

    const targetCount = Math.min(5, distinctDays.length);
    const selectedTicks: number[] = [];
    const chosenIndices = new Set<number>();

    for (let k = 0; k < targetCount; k++) {
      const idx = Math.round((k * (distinctDays.length - 1)) / (targetCount - 1));
      chosenIndices.add(idx);
    }

    for (const idx of Array.from(chosenIndices).sort((a, b) => a - b)) {
      const item = distinctDays[idx];
      const ms = getMs(item);
      selectedTicks.push(ms);
      tickLabels.set(ms, formatDayMonth(new Date(ms), locale, tz));
    }

    return {
      ticks: selectedTicks,
      formatTick: (v: number | string) => {
        const num = Number(v);
        if (tickLabels.has(num)) return tickLabels.get(num)!;
        const d = new Date(num);
        return isNaN(d.getTime()) ? String(v) : formatDayMonth(d, locale, tz);
      },
    };
  }

  // 30 Days: group by calendar day, display 5-7 evenly distributed date labels
  const dayGroups = new Map<string, BaseSeriesItem>();
  for (const item of data) {
    const ms = getMs(item);
    const d = new Date(ms);
    const dateKey = dayKeyFormatter.format(d);
    if (!dayGroups.has(dateKey)) {
      dayGroups.set(dateKey, item);
    }
  }

  const distinctDays = Array.from(dayGroups.values());
  if (distinctDays.length <= 6) {
    const ticks = distinctDays.map(getMs);
    for (const d of distinctDays) {
      const ms = getMs(d);
      tickLabels.set(ms, formatDayMonth(new Date(ms), locale, tz));
    }
    return {
      ticks,
      formatTick: (v: number | string) => {
        const num = Number(v);
        if (tickLabels.has(num)) return tickLabels.get(num)!;
        const d = new Date(num);
        return isNaN(d.getTime()) ? String(v) : formatDayMonth(d, locale, tz);
      },
    };
  }

  const targetCount = 6;
  const selectedTicks: number[] = [];
  const chosenIndices = new Set<number>();

  for (let k = 0; k < targetCount; k++) {
    const idx = Math.round((k * (distinctDays.length - 1)) / (targetCount - 1));
    chosenIndices.add(idx);
  }

  for (const idx of Array.from(chosenIndices).sort((a, b) => a - b)) {
    const item = distinctDays[idx];
    const ms = getMs(item);
    selectedTicks.push(ms);
    tickLabels.set(ms, formatDayMonth(new Date(ms), locale, tz));
  }

  return {
    ticks: selectedTicks,
    formatTick: (v: number | string) => {
      const num = Number(v);
      if (tickLabels.has(num)) return tickLabels.get(num)!;
      const d = new Date(num);
      return isNaN(d.getTime()) ? String(v) : formatDayMonth(d, locale, tz);
    },
  };
}

export function formatTooltipDateTime(
  timestamp: string | number | Date,
  preset?: string,
  locale: string = 'id',
  timeZone?: string
): string {
  const d = new Date(timestamp);
  const intlLocale = locale === 'en' ? 'en-US' : 'id-ID';
  const tz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Asia/Jakarta') ||
    'Asia/Jakarta';
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const timeStr = timeFormatter.format(d).replace(/\./g, ':');
  if (preset === '24h') {
    return timeStr;
  }
  const dateStr = formatDayMonth(d, locale, tz);
  return `${dateStr} ${timeStr}`;
}

export default function NPKChart({
  data = [],
  selectedMetric = 'npk',
  preset,
  loading = false,
  error = null,
  selectedLocationKey,
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

  const timeDomain = useMemo<[number, number] | ['dataMin', 'dataMax']>(() => {
    if (!data || data.length === 0) return ['dataMin', 'dataMax'];
    const getMs = (item: BaseSeriesItem): number =>
      typeof item.timestampMs === 'number' ? item.timestampMs : new Date(item.timestamp).getTime();
    const tFirst = getMs(data[0]);
    const tLast = getMs(data[data.length - 1]);
    if (tFirst === tLast && !isNaN(tFirst)) {
      // Single-point or equal-timestamp dataset: add +/- 1 hour padding so domain is non-degenerate
      return [tFirst - 3600000, tLast + 3600000];
    }
    return ['dataMin', 'dataMax'];
  }, [data]);

  const cleanLabelFormatter = (label: any, payload: any[]) => {
    if (
      payload &&
      payload.length > 0 &&
      (payload[0]?.payload?.timestamp || payload[0]?.payload?.timestampMs)
    ) {
      return formatTooltipDateTime(
        payload[0].payload.timestamp || payload[0].payload.timestampMs,
        preset,
        locale
      );
    }
    if (typeof label === 'number') {
      return formatTooltipDateTime(label, preset, locale);
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
      ) : selectedLocationKey !== undefined && !selectedLocationKey ? (
        <div className="h-44 w-full flex flex-col items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface font-medium">
            {tHistory('chartSelectLocation')}
          </span>
          <span className="text-[11px] text-app-on-surface-variant mt-1 max-w-md">
            {tHistory('chartSelectLocationHint')}
          </span>
        </div>
      ) : data.length === 0 ? (
        <div className="h-44 w-full flex items-center justify-center bg-app-surface-container/20 rounded-lg p-4 text-center">
          <span className="text-[13px] text-app-on-surface-variant font-medium">
            {selectedLocationKey ? tHistory('chartNoData') : tHistory('noData')}
          </span>
        </div>
      ) : (
        <div className="h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            {isSingleMetric && singleConfig ? (
              <AreaChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={singleConfig.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={singleConfig.color} stopOpacity={0} />
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
              <LineChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
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
