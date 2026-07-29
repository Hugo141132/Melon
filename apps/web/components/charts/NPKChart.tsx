'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NPK_TREND_DATA } from '@/lib/constants';

const NPK_COLORS = {
  n: '#0d631b',
  p: '#884200',
  k: '#476800',
};

export default function NPKChart() {
  return (
    <div className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[20px] leading-7 font-bold text-app-on-surface">Tren NPK (7 Hari)</h3>
        {/* Legend */}
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
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={NPK_TREND_DATA}
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
              domain={[0, 250]}
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
            <Bar dataKey="n" name="Nitrogen" fill={NPK_COLORS.n} radius={[4, 4, 0, 0]} />
            <Bar dataKey="p" name="Fosfor" fill={NPK_COLORS.p} radius={[4, 4, 0, 0]} />
            <Bar dataKey="k" name="Kalium" fill={NPK_COLORS.k} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
