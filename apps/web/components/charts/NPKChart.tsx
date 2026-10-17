'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  Brush,
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

export function NPKChartTooltipContent({
  active,
  payload,
  label,
  preset,
  locale,
  tCommon,
  defaultUnit = '',
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
        const unit = entry.unit !== undefined ? entry.unit : defaultUnit;
        const displayVal =
          val !== null && val !== undefined ? `${val} ${unit}`.trim() : tCommon('unavailable');
        return (
          <div key={`entry-${idx}`} className="flex items-center justify-between gap-3">
            <span className="text-app-on-surface-variant flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              {entry.name}
            </span>
            <span className="font-bold text-app-on-surface font-mono">{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
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

  const [brushIndices, setBrushIndices] = useState<{ startIndex?: number; endIndex?: number }>({});

  useEffect(() => {
    setBrushIndices({});
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
        <div className={data.length > 1 ? 'h-52 sm:h-60' : 'h-44 sm:h-52'}>
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
                  content={(props: any) => (
                    <NPKChartTooltipContent
                      {...props}
                      defaultUnit={singleConfig.unit}
                      preset={preset}
                      locale={locale}
                      tCommon={tCommon}
                    />
                  )}
                />
                <Area
                  type="linear"
                  dataKey={singleConfig.dataKey}
                  name={singleConfig.label}
                  stroke={singleConfig.color}
                  strokeWidth={2}
                  fill={`url(#grad-${selectedMetric})`}
                  connectNulls={false}
                  dot={{
                    r: 3,
                    fill: singleConfig.color,
                    stroke: '#ffffff',
                    strokeWidth: 1,
                  }}
                  activeDot={{
                    r: 6,
                    fill: singleConfig.color,
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />
                {data.length > 1 && (
                  <Brush
                    dataKey="timestampMs"
                    height={24}
                    stroke={singleConfig.color}
                    fill="#f8fafc"
                    tickFormatter={formatTick}
                    travellerWidth={10}
                    onChange={handleBrushChange}
                  />
                )}
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
                  content={(props: any) => (
                    <NPKChartTooltipContent
                      {...props}
                      defaultUnit="mg/kg"
                      preset={preset}
                      locale={locale}
                      tCommon={tCommon}
                    />
                  )}
                />
                <Line
                  type="linear"
                  dataKey="n"
                  name={tSoil('nitrogen')}
                  stroke={NPK_COLORS.n}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: NPK_COLORS.n, stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: NPK_COLORS.n, stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="linear"
                  dataKey="p"
                  name={tSoil('phosphorus')}
                  stroke={NPK_COLORS.p}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: NPK_COLORS.p, stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: NPK_COLORS.p, stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="linear"
                  dataKey="k"
                  name={tSoil('potassium')}
                  stroke={NPK_COLORS.k}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: NPK_COLORS.k, stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: NPK_COLORS.k, stroke: '#ffffff', strokeWidth: 2 }}
                />
                {data.length > 1 && (
                  <Brush
                    dataKey="timestampMs"
                    height={24}
                    stroke={NPK_COLORS.n}
                    fill="#f8fafc"
                    tickFormatter={formatTick}
                    travellerWidth={10}
                    onChange={handleBrushChange}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
