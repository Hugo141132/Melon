'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { NPK_TREND_DATA } from '@/lib/constants';
import { BaseSeriesItem } from '@/hooks/useHistoricalMonitoring';

const NPK_COLORS = {
  n: '#0d631b',
  p: '#884200',
  k: '#476800',
};

export interface NPKChartProps {
  data?: BaseSeriesItem[];
  selectedMetric?: string;
  loading?: boolean;
  error?: string | null;
}

export default function NPKChart({
  data = NPK_TREND_DATA as any[],
  selectedMetric = 'npk',
  loading = false,
  error = null,
}: NPKChartProps) {
  const tSoil = useTranslations('soil');
  const tHistory = useTranslations('history');
  const tCommon = useTranslations('common');

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
              <BarChart
                data={data}
                margin={{ top: 4, right: 0, left: -30, bottom: 0 }}
                barGap={2}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                <XAxis
                  dataKey="time"
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
                  formatter={(value: any, name: any) => [
                    value !== null && value !== undefined
                      ? `${value} mg/kg`
                      : tCommon('unavailable'),
                    name,
                  ]}
                />
                <Bar
                  dataKey="n"
                  name={tSoil('nitrogen')}
                  fill={NPK_COLORS.n}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="p"
                  name={tSoil('phosphorus')}
                  fill={NPK_COLORS.p}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="k"
                  name={tSoil('potassium')}
                  fill={NPK_COLORS.k}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
