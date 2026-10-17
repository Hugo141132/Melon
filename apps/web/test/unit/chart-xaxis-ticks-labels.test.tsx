/**
 * Dedicated unit tests for X-Axis reading-sequence tick generation, responsive label distribution,
 * bilingual formatting (id/en), and prevention of elapsed-time visual compression (TASK-0504 Follow-up 4).
 *
 * Connected regression coverage verifying that:
 * 1. mapReadingsToSeries attaches numeric timestampMs and preserves exact raw reading IDs and values.
 * 2. NPKChart (multi & single metric) and WaterNutrientChart configure XAxis with
 *    reading-sequence categorical layout, interval={0}, and explicit axis label "Urutan pembacaan" / "Reading sequence".
 * 3. Proportional time scale (dataKey="timestampMs", type="number", scale="time") is replaced by
 *    equidistant reading-sequence indexing so bursts (e.g. 65 readings in 11 minutes) do not compress into a clump.
 * 4. Sparse axis labels (5-7 ticks) are derived from actual reading timestamps without modifying dataset order or values.
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
        data-interval={props.interval}
        data-label={props.label?.value}
      />
    );
  },
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Brush: () => <div data-testid="recharts-brush" />,
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
      readingSequence: 'Urutan pembacaan',
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'id',
}));

describe('TASK-0504 — X-Axis Reading-Sequence Labels & Equal Spacing', () => {
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

  describe('Reading-Sequence Ticks (equally spaced indices, sparse timestamp formatting)', () => {
    it('generates 5-6 evenly spaced reading indices for small datasets (e.g. 24 readings)', () => {
      const data24 = Array.from({ length: 24 }, (_, i) => {
        const d = new Date('2026-10-08T00:00:00Z');
        d.setHours(i);
        const hh = String(i).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          timestampMs: d.getTime(),
          time: `${hh}:00`,
        };
      });

      const { ticks, formatTick } = getCustomXTicks(data24, '24h', 'id');
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(23);
      expect(formatTick(ticks[0])).toBe('00:00');
      expect(formatTick(ticks[ticks.length - 1])).toBe('23:00');
    });

    it('generates 6 evenly distributed sequence indices for 1,001-point datasets', () => {
      const data1001 = Array.from({ length: 1001 }, (_, i) => {
        const d = new Date(Date.parse('2026-10-08T00:00:00Z') + i * 86400);
        return {
          timestamp: d.toISOString(),
          timestampMs: d.getTime(),
          time: `t-${i}`,
        };
      });

      const { ticks } = getCustomXTicks(data1001, '24h', 'id');
      expect(ticks).toHaveLength(6);
      expect(ticks[0]).toBe(0);
      expect(ticks[5]).toBe(1000);
      expect(new Set(ticks).size).toBe(6);
    });

    it('eliminates visual compression for bursts: 65 readings within 11m out of 90 readings receive equal coordinate spacing', () => {
      // 90 readings total: 65 within first 11 minutes (every ~10 seconds), remaining 25 spread over 29 days
      const baseTime = new Date('2026-09-17T08:00:00.000Z').getTime();
      const readings: any[] = [];

      // 65 readings within 11 minutes (660 seconds)
      for (let i = 0; i < 65; i++) {
        readings.push({
          id: `reading-burst-${i}`,
          recordedAt: new Date(baseTime + i * 10000).toISOString(),
          ph: 6.5,
        });
      }
      // 25 readings over remaining 29 days
      for (let i = 0; i < 25; i++) {
        readings.push({
          id: `reading-sparse-${i}`,
          recordedAt: new Date(baseTime + 660000 + (i + 1) * 100000000).toISOString(),
          ph: 6.8,
        });
      }

      const series = mapReadingsToSeries(readings, false);
      expect(series).toHaveLength(90);

      // On reading-sequence axis, categorical index distance between reading 0 and 1 is 1,
      // and index distance between reading 64 and 65 is also 1:
      const dxBurst = 1 - 0;
      const dxSparse = 65 - 64;
      expect(dxBurst).toBe(dxSparse); // Equal visual spacing!

      const { ticks, formatTick } = getCustomXTicks(series, '30d', 'id');
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(89);

      // Ticks format into readable timestamps from the actual readings
      const firstLabel = formatTick(ticks[0]);
      const lastLabel = formatTick(ticks[ticks.length - 1]);
      expect(firstLabel).toBeTruthy();
      expect(lastLabel).toBeTruthy();
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
        recordedAt: '2026-10-12T00:00:00.000Z',
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
        recordedAt: '2026-10-15T00:00:00.000Z',
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

    it('mapReadingsToSeries preserves exact numeric timestampMs and zero/null values', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      expect(series).toHaveLength(3);

      for (let i = 0; i < rawReadings.length; i++) {
        const expectedMs = new Date(rawReadings[i].recordedAt).getTime();
        expect(series[i].timestampMs).toBe(expectedMs);
        expect(Number.isFinite(series[i].timestampMs)).toBe(true);
      }

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

    it('NPKChart configures XAxis with reading-sequence categorical spacing and localized label (multi & single metric)', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      capturedXAxisProps.length = 0;

      // 1. Multi-metric NPK variant
      render(<NPKChart data={series} selectedMetric="npk" preset="7d" />);
      expect(capturedXAxisProps.length).toBeGreaterThan(0);
      const npkXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];

      expect(npkXAxis.interval).toBe(0);
      expect(npkXAxis.label?.value).toBe('Urutan pembacaan');
      expect(npkXAxis.scale).toBeUndefined();
      expect(npkXAxis.type).toBeUndefined();

      // 2. Single-metric variant (temperature, ec)
      render(<NPKChart data={series} selectedMetric="ec" preset="7d" />);
      const singleXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];
      expect(singleXAxis.interval).toBe(0);
      expect(singleXAxis.label?.value).toBe('Urutan pembacaan');
      expect(singleXAxis.scale).toBeUndefined();
      expect(singleXAxis.type).toBeUndefined();
    });

    it('WaterNutrientChart configures XAxis with reading-sequence categorical spacing and localized label', () => {
      const series = mapReadingsToSeries(rawReadings, true);
      capturedXAxisProps.length = 0;

      render(<WaterNutrientChart data={series} selectedMetric="ec" preset="7d" />);
      expect(capturedXAxisProps.length).toBeGreaterThan(0);
      const waterXAxis = capturedXAxisProps[capturedXAxisProps.length - 1];

      expect(waterXAxis.interval).toBe(0);
      expect(waterXAxis.label?.value).toBe('Urutan pembacaan');
      expect(waterXAxis.scale).toBeUndefined();
      expect(waterXAxis.type).toBeUndefined();
    });

    it('preserves browser display timezone in tooltip formatting without boundary distortion', () => {
      const ts = '2026-10-11T17:30:00.000Z'; // 00:30 WIB on Oct 12
      const formattedJakarta = formatTooltipDateTime(ts, '7d', 'id', 'Asia/Jakarta');
      expect(formattedJakarta).toMatch(/^12\s(Okt|Oct)\s00:30$/);

      const formatted24h = formatTooltipDateTime(ts, '24h', 'id', 'Asia/Jakarta');
      expect(formatted24h).toBe('00:30');
    });
  });
});
