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

  const tz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Asia/Jakarta') ||
    'Asia/Jakarta';

  const intlLocale = locale === 'en' ? 'en-US' : 'id-ID';
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });

  const getMs = (it: BaseSeriesItem): number => {
    if (typeof it.timestampMs === 'number') return it.timestampMs;
    const t = new Date(it.timestamp).getTime();
    return isNaN(t) ? 0 : t;
  };

  const spanHours =
    data.length > 1 ? (getMs(data[data.length - 1]) - getMs(data[0])) / (1000 * 60 * 60) : 0;
  const isTimeFormat = preset === '24h' || (!preset && spanHours > 0 && spanHours <= 24);

  const formatItem = (item: BaseSeriesItem): string => {
    const raw = item.timestamp || item.timestampMs;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    if (isTimeFormat) {
      return timeFormatter.format(d).replace(/\./g, ':');
    }
    return formatDayMonth(d, locale, tz);
  };

  const n = data.length;
  if (n <= 1) {
    return {
      ticks: [0],
      formatTick: () => formatItem(data[0]),
    };
  }

  // Choose 4 to 6 sparse ticks equally distributed across the reading sequence
  const targetCount = preset === '7d' ? Math.min(5, n) : Math.min(6, n);
  const chosenIndices = new Set<number>();
  for (let k = 0; k < targetCount; k++) {
    const idx = Math.round((k * (n - 1)) / (targetCount - 1));
    chosenIndices.add(idx);
  }
  const ticks = Array.from(chosenIndices).sort((a, b) => a - b);

  return {
    ticks,
    formatTick: (v: number | string) => {
      const idx = Number(v);
      if (idx >= 0 && idx < n) {
        return formatItem(data[idx]);
      }
      const d = new Date(Number(v));
      if (!isNaN(d.getTime())) {
        if (isTimeFormat) {
          return timeFormatter.format(d).replace(/\./g, ':');
        }
        return formatDayMonth(d, locale, tz);
      }
      return String(v);
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
  allData,
  singleMetricKey,
}: any) {
  if (!active || !payload || payload.length === 0) return null;

  const firstItem = payload[0]?.payload as BaseSeriesItem | undefined;
  const rawTs = firstItem?.timestamp || firstItem?.timestampMs || label;
  const formattedTime = formatTooltipDateTime(rawTs, preset, locale);

  const currentTsMs =
    typeof firstItem?.timestampMs === 'number'
      ? firstItem.timestampMs
      : firstItem?.timestamp
        ? new Date(firstItem.timestamp).getTime()
        : typeof label === 'number'
          ? label
          : new Date(label).getTime();

  const matchingItems = useMemo<BaseSeriesItem[]>(() => {
    if (!allData || allData.length === 0) return firstItem ? [firstItem] : [];
    if (typeof currentTsMs !== 'number' || isNaN(currentTsMs)) {
      return firstItem ? [firstItem] : [];
    }
    const matches = allData.filter((item: BaseSeriesItem) => {
      const itemMs =
        typeof item.timestampMs === 'number'
          ? item.timestampMs
          : item.timestamp
            ? new Date(item.timestamp).getTime()
            : NaN;
      return itemMs === currentTsMs;
    });
    return matches.length > 0 ? matches : firstItem ? [firstItem] : [];
  }, [allData, firstItem, currentTsMs]);

  if (matchingItems.length > 1) {
    return (
      <div
        className="bg-white/95 backdrop-blur-sm border border-app-outline-variant/60 rounded-xl p-3 shadow-md text-xs space-y-2 min-w-[200px] max-w-[280px]"
        data-testid="chart-custom-tooltip"
      >
        <div className="font-semibold text-app-on-surface flex items-center justify-between gap-2 border-b border-app-outline-variant/30 pb-1">
          <span>{formattedTime}</span>
          <span className="font-semibold text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {tCommon('overlappingReadings', { count: matchingItems.length })}
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
          {matchingItems.map((item: BaseSeriesItem, idx: number) => {
            const itemRawTs = item.timestamp || item.timestampMs;
            const itemTimeStr = itemRawTs ? formatTooltipDateTime(itemRawTs, preset, locale) : '';
            const itemTimePart = itemTimeStr.split(' ').pop();
            return (
              <div
                key={item.readingId || `overlap-${idx}`}
                className="flex items-center justify-between gap-2 text-[11px] border-b border-app-outline-variant/15 pb-1 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="font-mono text-[10px] text-app-on-surface-variant bg-app-surface-container/60 px-1 py-0.5 rounded shrink-0"
                    title={String(item.readingId || '')}
                  >
                    ID: {String(item.readingId || '—').slice(0, 8)}
                  </span>
                  {itemTimePart && (
                    <span className="text-[10px] text-app-on-surface-variant shrink-0">
                      {itemTimePart}
                    </span>
                  )}
                </div>
                {singleMetricKey ? (
                  <span className="font-bold text-app-on-surface font-mono shrink-0">
                    {item[singleMetricKey] !== null && item[singleMetricKey] !== undefined
                      ? `${item[singleMetricKey]} ${defaultUnit}`.trim()
                      : tCommon('unavailable')}
                  </span>
                ) : (
                  <span className="font-bold text-app-on-surface font-mono text-[10px] shrink-0">
                    N:{item.n ?? '-'} P:{item.p ?? '-'} K:{item.k ?? '-'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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

const EMPTY_DATA: BaseSeriesItem[] = [];

export default function NPKChart({
  data = EMPTY_DATA,
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
              <AreaChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 20 }}>
                <defs>
                  <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={singleConfig.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={singleConfig.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                <XAxis
                  ticks={ticks.length > 0 ? ticks : undefined}
                  tickFormatter={formatTick}
                  interval={0}
                  tick={{ fontSize: 11, fill: '#40493d' }}
                  padding={{ left: 16, right: 16 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: tCommon('readingSequence'),
                    position: 'insideBottom',
                    offset: -12,
                    fill: '#71796f',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
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
                      allData={data}
                      singleMetricKey={singleConfig.dataKey}
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
                  dot={false}
                  activeDot={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                <XAxis
                  ticks={ticks.length > 0 ? ticks : undefined}
                  tickFormatter={formatTick}
                  interval={0}
                  tick={{ fontSize: 11, fill: '#40493d' }}
                  padding={{ left: 16, right: 16 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: tCommon('readingSequence'),
                    position: 'insideBottom',
                    offset: -12,
                    fill: '#71796f',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
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
                      allData={data}
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
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="linear"
                  dataKey="p"
                  name={tSoil('phosphorus')}
                  stroke={NPK_COLORS.p}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="linear"
                  dataKey="k"
                  name={tSoil('potassium')}
                  stroke={NPK_COLORS.k}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={false}
                  activeDot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
