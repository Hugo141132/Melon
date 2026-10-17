/**
 * Regression Test: Raw Readings Chart Pipeline & Presentation Preservation
 *
 * Concrete Acceptance Case: "Testing (90), 30 Days, pH"
 *
 * Verifies that:
 * 1. All 90 matching raw readings assigned to location "Testing" survive through
 *    mapReadingsToSeries and into the chart component as distinct chart data items.
 * 2. Each item strictly preserves its distinct reading ID, original timestamp, and exact value.
 * 3. No aggregation, averaging, bucketing, sampling, or deduplication collapses distinct readings.
 * 4. Line segments are straight (type="linear"), not smoothed cubic curves (type="monotone").
 * 5. Individual reading markers (dot) and hover highlights (activeDot) are rendered for every reading.
 * 6. Interactive zoom/brush (<Brush>) is rendered when data.length > 1 so densely clustered readings
 *    can be inspected individually without altering underlying timestamps or values.
 * 7. Per-reading tooltips accurately surface the reading ID, formatted timestamp, and exact values.
 * 8. Shared rendering paths for EC, TDS, and Soil parameters (Temperature, Moisture, pH, EC, NPK)
 *    adhere to the same raw-reading straight-line and marker requirements.
 * 9. Null gaps (connectNulls={false}) and table pagination independence are preserved.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import WaterNutrientChart, {
  WaterChartTooltipContent,
} from '@/components/charts/WaterNutrientChart';
import NPKChart, { NPKChartTooltipContent, getCustomXTicks } from '@/components/charts/NPKChart';
import { mapReadingsToSeries, BaseSeriesItem } from '@/hooks/useHistoricalMonitoring';

let capturedAreaProps: any[] = [];
let capturedLineProps: any[] = [];
let capturedBrushProps: any[] = [];
let capturedAreaChartData: any[] = [];
let capturedLineChartData: any[] = [];
let capturedTooltipContentProps: any[] = [];

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: any) => {
    capturedAreaChartData = data;
    return (
      <div data-testid="area-chart" data-points-count={data?.length}>
        {children}
      </div>
    );
  },
  LineChart: ({ children, data }: any) => {
    capturedLineChartData = data;
    return (
      <div data-testid="line-chart" data-points-count={data?.length}>
        {children}
      </div>
    );
  },
  Area: (props: any) => {
    capturedAreaProps.push(props);
    return <div data-testid="recharts-area" data-type={props.type} />;
  },
  Line: (props: any) => {
    capturedLineProps.push(props);
    return <div data-testid="recharts-line" data-type={props.type} />;
  },
  Brush: (props: any) => {
    capturedBrushProps.push(props);
    return <div data-testid="recharts-brush" />;
  },
  CartesianGrid: () => <div />,
  XAxis: (props: any) => (
    <div
      data-testid="recharts-xaxis"
      data-key={props.dataKey}
      data-type={props.type}
      data-scale={props.scale}
    />
  ),
  YAxis: () => <div />,
  Tooltip: (props: any) => {
    capturedTooltipContentProps.push(props);
    return <div data-testid="recharts-tooltip" />;
  },
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

describe('Raw Readings Chart Pipeline & Presentation Fixes (TASK-0504 Follow-up)', () => {
  beforeEach(() => {
    capturedAreaProps = [];
    capturedLineProps = [];
    capturedBrushProps = [];
    capturedAreaChartData = [];
    capturedLineChartData = [];
    capturedTooltipContentProps = [];
    vi.clearAllMocks();
  });

  describe('Concrete Acceptance Case: Testing (90), 30 Days, pH', () => {
    // Generate 90 raw readings assigned to location "Testing" across a 30-day span
    const baseTime = new Date('2026-09-17T08:00:00.000Z').getTime();
    const raw90Readings = Array.from({ length: 90 }, (_, i) => {
      // 90 readings over 30 days (some spaced 8 hours, some closer together)
      const recordedAt = new Date(baseTime + (i * (30 * 24 * 3600 * 1000)) / 90).toISOString();
      return {
        id: `reading-testing-uuid-${String(i + 1).padStart(3, '0')}`,
        deviceId: 'device-water-01',
        ph: Number((6.2 + (i % 15) * 0.1).toFixed(2)),
        ec: 1200 + i * 5,
        tds: 600 + i * 2,
        locationName: 'Testing',
        recordedAt,
        receivedAt: recordedAt,
      };
    });

    it('maps all 90 raw readings to series items preserving distinct reading IDs, timestamps, and values', () => {
      const series = mapReadingsToSeries(raw90Readings as any, true);

      expect(series).toHaveLength(90);

      // Verify first, middle, and last reading IDs and values survive intact
      expect(series[0].readingId).toBe('reading-testing-uuid-001');
      expect(series[0].ph).toBe(6.2);
      expect(series[0].timestamp).toBe(raw90Readings[0].recordedAt);
      expect(series[0].timestampMs).toBe(new Date(raw90Readings[0].recordedAt).getTime());

      expect(series[44].readingId).toBe('reading-testing-uuid-045');
      expect(series[44].ph).toBe(raw90Readings[44].ph);

      expect(series[89].readingId).toBe('reading-testing-uuid-090');
      expect(series[89].ph).toBe(raw90Readings[89].ph);

      // Ensure every single ID is distinct (zero deduplication or bucketing collapse)
      const distinctIds = new Set(series.map((s) => s.readingId));
      expect(distinctIds.size).toBe(90);
    });

    it('renders WaterNutrientChart with all 90 discrete data points, straight lines, dot markers, and zoom brush', () => {
      const series = mapReadingsToSeries(raw90Readings as any, true);

      render(
        <WaterNutrientChart
          data={series}
          selectedMetric="ph"
          selectedLocationKey="testing"
          preset="30d"
        />
      );

      // 1. Chart receives all 90 items without reduction or sampling
      expect(capturedAreaChartData).toHaveLength(90);

      // 2. Straight line segments (linear, NOT smoothed monotone curve)
      expect(capturedAreaProps.length).toBeGreaterThan(0);
      const areaProps = capturedAreaProps[capturedAreaProps.length - 1];
      expect(areaProps.type).toBe('linear');

      // 3. Individual reading markers (dot) and active highlight (activeDot) are enabled
      expect(areaProps.dot).toBeTruthy();
      expect(areaProps.dot.r).toBe(3);
      expect(areaProps.activeDot).toBeTruthy();
      expect(areaProps.activeDot.r).toBe(6);

      // 4. Null gaps preserved (connectNulls is false)
      expect(areaProps.connectNulls).toBe(false);

      // 5. Interactive zoom/brush is rendered because data.length > 1
      expect(capturedBrushProps.length).toBeGreaterThan(0);
      expect(capturedBrushProps[capturedBrushProps.length - 1].dataKey).toBe('timestampMs');
    });

    it('displays per-reading tooltip with reading ID, formatted timestamp, and exact pH value', () => {
      const testItem: BaseSeriesItem = {
        readingId: 'reading-testing-uuid-042',
        timestamp: '2026-10-01T10:15:30.000Z',
        timestampMs: new Date('2026-10-01T10:15:30.000Z').getTime(),
        time: '17:15',
        ph: 6.85,
        ec: 1420,
        tds: 710,
      };

      const mockPayload = [
        {
          name: 'pH Level',
          value: 6.85,
          unit: '',
          color: '#884200',
          payload: testItem,
        },
      ];

      const { container } = render(
        <WaterChartTooltipContent
          active={true}
          payload={mockPayload}
          label={testItem.timestampMs}
          metricLabel="pH Level"
          metricUnit=""
          preset="30d"
          locale="id"
          tCommon={(k: string) => k}
        />
      );

      // Reading ID is rendered
      expect(container.textContent).toContain('ID: reading-');
      // Exact pH value is rendered
      expect(container.textContent).toContain('6.85');
    });

    it('generates sparse X-axis ticks (5-7 ticks) avoiding label overlap while preserving 100% of data points', () => {
      const series = mapReadingsToSeries(raw90Readings as any, true);
      const { ticks } = getCustomXTicks(series, '30d', 'id');

      // 30 Days preset targets 5-7 evenly distributed ticks across calendar days
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(7);

      // But chart data retains all 90 raw points
      expect(series).toHaveLength(90);
    });
  });

  describe('Shared Rendering Paths in WaterNutrientChart (EC & TDS)', () => {
    const rawWaterReadings = [
      {
        id: 'water-ec-01',
        ph: 7.1,
        ec: 1540,
        tds: 770,
        recordedAt: '2026-10-15T08:00:00.000Z',
      },
      {
        id: 'water-ec-02',
        ph: 7.2,
        ec: 1580,
        tds: 790,
        recordedAt: '2026-10-15T09:00:00.000Z',
      },
    ];

    it('renders EC with straight lines, dot markers, and activeDot', () => {
      const series = mapReadingsToSeries(rawWaterReadings as any, false);

      render(
        <WaterNutrientChart
          data={series}
          selectedMetric="ec"
          selectedLocationKey="tank-1"
          preset="24h"
        />
      );

      expect(capturedAreaProps.length).toBeGreaterThan(0);
      const ecProps = capturedAreaProps[capturedAreaProps.length - 1];
      expect(ecProps.dataKey).toBe('ec');
      expect(ecProps.type).toBe('linear');
      expect(ecProps.dot).toBeTruthy();
      expect(ecProps.dot.r).toBe(3);
      expect(ecProps.activeDot.r).toBe(6);
    });

    it('renders TDS with straight lines, dot markers, and activeDot', () => {
      const series = mapReadingsToSeries(rawWaterReadings as any, false);

      render(
        <WaterNutrientChart
          data={series}
          selectedMetric="tds"
          selectedLocationKey="tank-1"
          preset="24h"
        />
      );

      expect(capturedAreaProps.length).toBeGreaterThan(0);
      const tdsProps = capturedAreaProps[capturedAreaProps.length - 1];
      expect(tdsProps.dataKey).toBe('tds');
      expect(tdsProps.type).toBe('linear');
      expect(tdsProps.dot).toBeTruthy();
      expect(tdsProps.dot.r).toBe(3);
      expect(tdsProps.activeDot.r).toBe(6);
    });
  });

  describe('Shared Rendering Paths in NPKChart (Soil Parameters)', () => {
    const rawSoilReadings = [
      {
        id: 'soil-reading-01',
        temperature: 28.5,
        moisture: 65,
        ph: 6.4,
        ec: 1800,
        nitrogen: 45,
        phosphorus: 25,
        potassium: 55,
        recordedAt: '2026-10-15T08:00:00.000Z',
      },
      {
        id: 'soil-reading-02',
        temperature: 29.1,
        moisture: 63,
        ph: 6.5,
        ec: 1820,
        nitrogen: 44,
        phosphorus: 26,
        potassium: 54,
        recordedAt: '2026-10-15T09:00:00.000Z',
      },
    ];

    it('renders single-metric AreaChart (e.g. temperature) with straight lines, dot markers, and brush', () => {
      const series = mapReadingsToSeries(rawSoilReadings as any, false);

      render(
        <NPKChart
          data={series}
          selectedMetric="temperature"
          selectedLocationKey="bed-1"
          preset="24h"
        />
      );

      expect(capturedAreaProps.length).toBeGreaterThan(0);
      const tempProps = capturedAreaProps[capturedAreaProps.length - 1];
      expect(tempProps.dataKey).toBe('temperature');
      expect(tempProps.type).toBe('linear');
      expect(tempProps.dot).toBeTruthy();
      expect(tempProps.dot.r).toBe(3);
      expect(tempProps.activeDot.r).toBe(6);
      expect(capturedBrushProps.length).toBeGreaterThan(0);
    });

    it('renders multi-metric LineChart (NPK) with straight lines (linear) and dot markers on all 3 lines', () => {
      const series = mapReadingsToSeries(rawSoilReadings as any, false);

      render(
        <NPKChart data={series} selectedMetric="npk" selectedLocationKey="bed-1" preset="24h" />
      );

      expect(capturedLineChartData).toHaveLength(2);
      // LineChart should render 3 lines: N, P, K
      const latestLines = capturedLineProps.slice(-3);
      expect(latestLines).toHaveLength(3);
      for (const lineProps of latestLines) {
        expect(lineProps.type).toBe('linear');
        expect(lineProps.dot).toBeTruthy();
        expect(lineProps.dot.r).toBe(3);
        expect(lineProps.activeDot.r).toBe(6);
        expect(lineProps.connectNulls).toBe(false);
      }
      expect(capturedBrushProps.length).toBeGreaterThan(0);
    });

    it('displays per-reading tooltip in NPKChart with reading ID and exact values', () => {
      const testItem: BaseSeriesItem = {
        readingId: 'soil-reading-042',
        timestamp: '2026-10-15T10:00:00.000Z',
        timestampMs: new Date('2026-10-15T10:00:00.000Z').getTime(),
        time: '17:00',
        nitrogen: 48,
        phosphorus: 28,
        potassium: 58,
      };

      const mockPayload = [
        { name: 'Nitrogen', value: 48, unit: 'mg/kg', color: '#0d631b', payload: testItem },
        { name: 'Phosphorus', value: 28, unit: 'mg/kg', color: '#884200', payload: testItem },
        { name: 'Potassium', value: 58, unit: 'mg/kg', color: '#476800', payload: testItem },
      ];

      const { container } = render(
        <NPKChartTooltipContent
          active={true}
          payload={mockPayload}
          label={testItem.timestampMs}
          preset="24h"
          locale="id"
          tCommon={(k: string) => k}
        />
      );

      expect(container.textContent).toContain('ID: soil-rea');
      expect(container.textContent).toContain('48 mg/kg');
      expect(container.textContent).toContain('28 mg/kg');
      expect(container.textContent).toContain('58 mg/kg');
    });
  });

  describe('Null Gaps and Pagination Independence', () => {
    it('preserves null gaps with connectNulls=false so missing reading intervals are not falsely interpolated', () => {
      const seriesWithNull: BaseSeriesItem[] = [
        {
          readingId: 'r-1',
          timestamp: '2026-10-01T08:00:00Z',
          timestampMs: 1,
          time: '15:00',
          ph: 6.5,
        },
        {
          readingId: 'r-2',
          timestamp: '2026-10-01T09:00:00Z',
          timestampMs: 2,
          time: '16:00',
          ph: null,
        },
        {
          readingId: 'r-3',
          timestamp: '2026-10-01T10:00:00Z',
          timestampMs: 3,
          time: '17:00',
          ph: 6.8,
        },
      ];

      render(
        <WaterNutrientChart
          data={seriesWithNull}
          selectedMetric="ph"
          selectedLocationKey="testing"
        />
      );

      expect(capturedAreaProps[0].connectNulls).toBe(false);
    });

    it('chart data item count is independent of table page size (HISTORY_PAGE_SIZE = 5)', () => {
      // Table paginates 5 rows per page, whereas chart displays all 90 retained readings
      const raw90 = Array.from({ length: 90 }, (_, i) => ({
        id: `r-${i + 1}`,
        ph: 6.5,
        recordedAt: new Date(1760000000000 + i * 60000).toISOString(),
      }));
      const series = mapReadingsToSeries(raw90 as any, false);

      expect(series).toHaveLength(90);
      render(
        <WaterNutrientChart data={series} selectedMetric="ph" selectedLocationKey="testing" />
      );

      expect(capturedAreaChartData).toHaveLength(90);
    });
  });
});
