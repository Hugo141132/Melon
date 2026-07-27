'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EC_TREND_DATA } from '@/lib/constants';

export default function WaterNutrientChart() {
  const [activeKey, setActiveKey] = useState<'ec' | 'ph'>('ec');

  const ecConfig = {
    key: 'ec' as const,
    color: '#0d631b',
    label: 'EC (mS/cm)',
    domain: [1.2, 2.2] as [number, number],
  };
  const phConfig = {
    key: 'ph' as const,
    color: '#884200',
    label: 'pH Level',
    domain: [5.5, 7.0] as [number, number],
  };

  const active = activeKey === 'ec' ? ecConfig : phConfig;

  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[20px] leading-7 font-bold text-app-on-surface">
          Tren Nutrisi (24 Jam)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveKey('ec')}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer transition-colors ${
              activeKey === 'ec'
                ? 'bg-app-primary text-white'
                : 'bg-app-surface-container text-app-on-surface-variant'
            }`}
          >
            EC
          </button>
          <button
            onClick={() => setActiveKey('ph')}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer transition-colors ${
              activeKey === 'ph'
                ? 'bg-app-primary text-white'
                : 'bg-app-surface-container text-app-on-surface-variant'
            }`}
          >
            pH
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={EC_TREND_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="gradWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={active.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={active.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#40493d' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={active.domain}
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
            />
            <Area
              type="monotone"
              dataKey={active.key}
              name={active.label}
              stroke={active.color}
              strokeWidth={3}
              fill="url(#gradWater)"
              dot={false}
              activeDot={{ r: 5, fill: active.color }}
              strokeLinecap="round"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
