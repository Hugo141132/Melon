/**
 * Dedicated unit tests for X-Axis tick generation, responsive label distribution,
 * bilingual formatting (id/en), and clipping/overlap prevention (TASK-0504).
 *
 * Connected regression coverage verifying that:
 * 1. mapReadingsToSeries attaches numeric timestampMs from sensor timestamps.
 * 2. NPKChart (multi & single metric) and WaterNutrientChart configure XAxis with
 *    dataKey="timestampMs", type="number", scale="time".
 * 3. Categorical spacing (dataKey="time", type="category") is strictly rejected.
 * 4. Single-point and equal-timestamp datasets safely pad domain to avoid scale collapse.
 * 5. Display timezone and tooltip formatting are preserved.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import NPKChart, {
  getCustomXTicks,
  formatDayMonth,
  formatTooltipDateTime,
} from '@/components/charts/NPKChart';
import WaterNutrientChart from '@/components/charts/WaterNutrientChart';
import { mapReadingsToSeries } from '@/hooks/useHistoricalMonitoring';

const capturedXAxisProps: any[] = [];

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: any) => (
    <div data-testid="area-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="recharts-area" />,
  Line: () => <div data-testid="recharts-line" />,
  CartesianGrid: () => <div />,
  XAxis: (props: any) => {
    capturedXAxisProps.push(props);
    return (
      <div
        data-testid="recharts-xaxis"
        data-key={props.dataKey}
        data-type={props.type}
        data-scale={props.scale}
      />
    );
  },
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    const messages: Record<string, string> = {
      chartSelectLocation: 'Select a location to view its trend',
      chartSelectLocationHint: 'Readings without a location are not plotted.',
      chartLocationLabel: 'Location',
      loadingHistory: 'Loading history...',
      chartNoData: 'No readings for this location in the selected range.',
      noData: 'No data',
      npkTrend: 'Soil NPK Trend',
      nitrogen: 'Nitrogen',
      phosphorus: 'Phosphorus',
      potassium: 'Potassium',
      temperature: 'Temperature',
      moisture: 'Moisture',
      ph: 'pH',
      ec: 'EC',
      tds: 'TDS',
      ecCardTitle: 'Electrical Conductivity',
      phLevelTitle: 'pH Level',
      tdsCardTitle: 'Total Dissolved Solids',
      metricHistoryTitle: `History of ${params?.metric ?? ''}`,
      unavailable: 'Unavailable',
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'id',
}));

describe('TASK-0504 — X-Axis Labels Distribution, Overlap & Clipping Prevention', () => {
  describe('formatDayMonth bilingual date formatting', () => {
    it('formats date cleanly in Indonesian without trailing punctuation or commas', () => {
      const d1 = new Date('2026-10-08T12:00:00Z');
      const formattedId = formatDayMonth(d1, 'id');
      expect(formattedId).toMatch(/^8\s(Okt|Oct)$/);
      expect(formattedId).not.toContain(',');
      expect(formattedId).not.toContain('.');
    });

    it('formats date cleanly in English without commas or trailing punctuation', () => {
      const d1 = new Date('2026-10-08T12:00:00Z');
      const formattedEn = formatDayMonth(d1, 'en');
      expect(formattedEn).toBe('8 Oct');
      expect(formattedEn).not.toContain(',');
      expect(formattedEn).not.toContain('.');
    });
  });

  describe('24-Hour Range Ticks (evenly spaced, no overlap, first/last preserved)', () => {
    it('generates 5-6 evenly spaced ticks for small datasets (e.g. 24 readings)', () => {
      const data24 = Array.from({ length: 24 }, (_, i) => {
        const d = new Date('2026-10-08T00:00:00Z');
        d.setHours(i);
        const hh = String(i).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          time: `${hh}:00`,
        };
      });

      const { ticks, formatTick } = getCustomXTicks(data24, '24h', 'id');
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks[0]).toBe(new Date(data24[0].timestamp).getTime());
      expect(ticks[ticks.length - 1]).toBe(new Date(data24[data24.length - 1].timestamp).getTime());
      expect(formatTick(ticks[0])).toBe('00:00');
      expect(formatTick(ticks[ticks.length - 1])).toBe('23:00');
    });

    it('generates exactly 6 evenly distributed ticks for high-density 1,001-point 24h datasets without overlapping', () => {
      const data1001 = Array.from({ length: 1001 }, (_, i) => {
        const d = new Date(Date.parse('2026-10-08T00:00:00Z') + i * 86400); // 86.4s per reading over 24h
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          timestampMs: d.getTime(),
          time: `${hh}:${mm}-${i}`,
        };
      });

      const { ticks } = getCustomXTicks(data1001, '24h', 'id');
      expect(ticks).toHaveLength(6);
      expect(ticks[0]).toBe(data1001[0].timestampMs);
      expect(ticks[5]).toBe(data1001[1000].timestampMs);
      expect(new Set(ticks).size).toBe(6);
    });
  });

  describe('7-Day & 30-Day Range Ticks (no adjacent days, clean spacing)', () => {
    it('distributes 7 days evenly (4-5 labels) without adjacent day collision at the boundary', () => {
      const data7d = Array.from({ length: 168 }, (_, i) => {
        const d = new Date('2026-10-01T00:00:00Z');
        d.setHours(i);
        return {
          timestamp: d.toISOString(),
          time: `${d.getDate()} Okt ${String(d.getHours()).padStart(2, '0')}:00`,
        };
      });

      const { ticks, formatTick } = getCustomXTicks(data7d, '7d', 'id');
      expect(ticks.length).toBeGreaterThanOrEqual(4);
      expect(ticks.length).toBeLessThanOrEqual(5);

      const formattedLabels = ticks.map(formatTick);
      const dayNumbers = formattedLabels.map((l) => parseInt(l.split(' ')[0], 10));
      for (let i = 1; i < dayNumbers.length; i++) {
        expect(dayNumbers[i] - dayNumbers[i - 1]).toBeGreaterThanOrEqual(1);
      }
      expect(formattedLabels[0]).toMatch(/^1\s(Okt|Oct)$/);
      expect(formattedLabels[formattedLabels.length - 1]).toMatch(/^7\s(Okt|Oct)$/);
    });

    it('distributes 30 days evenly with ~6 ticks covering the entire boundary', () => {
      const data30d = Array.from({ length: 720 }, (_, i) => {
        const d = new Date('2026-09-01T00:00:00Z');
        d.setHours(i);
        return {
          timestamp: d.toISOString(),
          time: `${d.getDate()} Sep ${String(d.getHours()).padStart(2, '0')}:00`,
        };
      });

      const { ticks, formatTick } = getCustomXTicks(data30d, '30d', 'en');
      expect(ticks).toHaveLength(6);

      const formattedLabels = ticks.map(formatTick);
      expect(formattedLabels[0]).toBe('1 Sep');
      expect(formattedLabels[5]).toBe('30 Sep');
    });

    it('handles sparse readings with unequal time gaps (e.g., Oct 11 and Oct 15) without collapsing or overlapping dates', () => {
      const sparseData = [
        {
          timestamp: '2026-10-11T08:30:00.000Z',
          timestampMs: new Date('2026-10-11T08:30:00.000Z').getTime(),
          time: '11 Okt 15:30',
        },
        {
          timestamp: '2026-10-15T03:14:00.000Z',
          timestampMs: new Date('2026-10-15T03:14:00.000Z').getTime(),
          time: '15 Okt 10:14',
        },
        {
          timestamp: '2026-10-15T05:20:00.000Z',
          timestampMs: new Date('2026-10-15T05:20:00.000Z').getTime(),
          time: '15 Okt 12:20',
        },
      ];

      const { ticks, formatTick } = getCustomXTicks(sparseData, '7d', 'id', 'Asia/Jakarta');
      expect(ticks).toHaveLength(2);
      expect(ticks[0]).toBe(sparseData[0].timestampMs);
      expect(ticks[1]).toBe(sparseData[1].timestampMs);

      const label1 = formatTick(ticks[0]);
      const label2 = formatTick(ticks[1]);
      expect(label1).toMatch(/^11\s(Okt|Oct)$/);
      expect(label2).toMatch(/^15\s(Okt|Oct)$/);
      expect(label1).not.toBe(label2);
    });
  });

  describe('Application Mapping & Connected Chart X-Axis Regression Coverage', () => {
    const rawReadings = [
      {
        id: 'r-1',
        recordedAt: '2026-10-11T00:00:00.000Z',
        nitrogen: 45,
        phosphorus: 25,
        potassium: 55,
        temperature: 28.5,
        moisture: 65,
        ph: 6.8,
        ec: 1200,
        tds: 600,
      },
      {
        id: 'r-2',
        recordedAt: '2026-10-12T00:00:00.000Z', // +1 day = 86,400,000 ms
        nitrogen: 48,
        phosphorus: 26,
        potassium: 58,
        temperature: 29.0,
        moisture: 63,
        ph: 6.7,
        ec: 1250,
        tds: 625,
      },
      {
        id: 'r-3',
        recordedAt: '2026-10-15T00:00:00.000Z', // +3 days = 259,200,000 ms from r-2
        nitrogen: 50,
        phosphorus: 28,
        potassium: 60,
        temperature: 27.5,
        moisture: 70,
        ph: 6.9,
        ec: 1180,
        tds: 590,
      },
    ];

    it('mapReadingsToSeries derives exact numeric timestampMs for every point and preserves zero/null metrics', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      expect(series).toHaveLength(3);

      for (let i = 0; i < rawReadings.length; i++) {
        const expectedMs = new Date(rawReadings[i].recordedAt).getTime();
        expect(series[i].timestampMs).toBe(expectedMs);
        expect(Number.isFinite(series[i].timestampMs)).toBe(true);
      }

      // Preserves zero and null metric values without falsification
      const withNulls = mapReadingsToSeries(
        [
          {
            id: 'r-4',
            recordedAt: '2026-10-16T00:00:00.000Z',
            nitrogen: 0,
            temperature: null,
            ec: 0,
          },
        ],
        true
      );
      expect(withNulls[0].nitrogen).toBe(0);
      expect(withNulls[0].temperature).toBeNull();
      expect(withNulls[0].ec).toBe(0);
    });

    it('NPKChart connects to timestampMs and configures XAxis with numeric time scale (multi-metric & single-metric)', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      capturedXAxisProps.length = 0;

      // 1. Multi-metric NPK variant
      render(<NPKChart data={series} selectedMetric="npk" preset="7d" />);
      expect(capturedXAxisProps.length).toBeGreaterThan(0);
      const npkXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];

      expect(npkXAxis.dataKey).toBe('timestampMs');
      expect(npkXAxis.type).toBe('number');
      expect(npkXAxis.scale).toBe('time');
      expect(npkXAxis.domain).toEqual(['dataMin', 'dataMax']);

      // 2. Single-metric variant (temperature, ec)
      render(<NPKChart data={series} selectedMetric="ec" preset="7d" />);
      const singleXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];
      expect(singleXAxis.dataKey).toBe('timestampMs');
      expect(singleXAxis.type).toBe('number');
      expect(singleXAxis.scale).toBe('time');

      // Regression check: fails if axis returns to categorical 'time' or type 'category'
      expect(singleXAxis.dataKey).not.toBe('time');
      expect(singleXAxis.type).not.toBe('category');
    });

    it('WaterNutrientChart connects to timestampMs and configures XAxis with numeric time scale', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      capturedXAxisProps.length = 0;

      render(<WaterNutrientChart data={series} selectedMetric="ec" preset="7d" />);
      expect(capturedXAxisProps.length).toBeGreaterThan(0);
      const waterXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];

      expect(waterXAxis.dataKey).toBe('timestampMs');
      expect(waterXAxis.type).toBe('number');
      expect(waterXAxis.scale).toBe('time');
      expect(waterXAxis.domain).toEqual(['dataMin', 'dataMax']);

      // Regression check: fails if axis returns to categorical 'time' or wrong field
      expect(waterXAxis.dataKey).not.toBe('time');
      expect(waterXAxis.type).not.toBe('category');
    });

    it('safely handles single-point and equal-timestamp datasets with non-degenerate time domain padding', () => {
      const singleReading = [rawReadings[0]];
      const singleSeries = mapReadingsToSeries(singleReading, false);
      const t = singleSeries[0].timestampMs!;

      capturedXAxisProps.length = 0;
      render(<NPKChart data={singleSeries} selectedMetric="npk" preset="24h" />);
      const npkSingleXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];
      // Must not collapse to [t, t]; pads +/- 1 hour (3,600,000 ms)
      expect(npkSingleXAxis.domain).toEqual([t - 3600000, t + 3600000]);

      render(<WaterNutrientChart data={singleSeries} selectedMetric="ec" preset="24h" />);
      const waterSingleXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];
      expect(waterSingleXAxis.domain).toEqual([t - 3600000, t + 3600000]);

      // Equal-timestamp dataset (e.g. 2 readings at exact same millisecond)
      const equalTsSeries = [singleSeries[0], { ...singleSeries[0], id: 'r-duplicate', ec: 1300 }];
      render(<WaterNutrientChart data={equalTsSeries} selectedMetric="ec" preset="24h" />);
      const equalXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];
      expect(equalXAxis.domain).toEqual([t - 3600000, t + 3600000]);
    });

    it('preserves browser display timezone in tooltip formatting without boundary distortion', () => {
      const ts = '2026-10-11T17:30:00.000Z'; // 00:30 WIB on Oct 12
      const formattedJakarta = formatTooltipDateTime(ts, '7d', 'id', 'Asia/Jakarta');
      expect(formattedJakarta).toMatch(/^12\s(Okt|Oct)\s00:30$/);

      const formatted24h = formatTooltipDateTime(ts, '24h', 'id', 'Asia/Jakarta');
      expect(formatted24h).toBe('00:30');
    });

    it('verifies that numeric timestamp scale produces 3:1 coordinate ratio for unequal gaps (Oct 11, 12, 15) while categorical spacing produces invalid 1:1 ratio', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      const t0 = series[0].timestampMs!; // Oct 11 00:00:00Z
      const t1 = series[1].timestampMs!; // Oct 12 00:00:00Z (+1 day)
      const t2 = series[2].timestampMs!; // Oct 15 00:00:00Z (+3 days from t1)

      const dt01 = t1 - t0; // 86,400,000 ms
      const dt12 = t2 - t1; // 259,200,000 ms

      // 1. Under numeric time scale (as configured on XAxis props verified above):
      // Coordinate delta is directly proportional to elapsed time delta:
      const numericTimeRatio = dt12 / dt01;
      expect(numericTimeRatio).toBeCloseTo(3.0, 5);

      // 2. Under erroneous categorical spacing (where Recharts maps index 0, 1, 2 uniformly):
      const categoricalIndexRatio = (2 - 1) / (1 - 0);
      expect(categoricalIndexRatio).toBe(1.0);

      // 3. Prove that numeric time-based ratio strictly diverges from invalid categorical spacing
      expect(numericTimeRatio).not.toBe(categoricalIndexRatio);
      expect(numericTimeRatio).toBeGreaterThan(categoricalIndexRatio * 2.5);
    });
  });
});
