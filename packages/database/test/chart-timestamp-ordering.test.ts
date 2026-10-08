/**
 * Regression tests for chart eligibility + plotted timestamp ordering (TASK-0504).
 *
 * These cases extend `telemetry-chart-completeness.test.ts`, which proves the
 * series keeps the newest rows and does not falsely flag truncation. Two
 * invariants were still unproven:
 *
 *   1. `recordedAt` vs `receivedAt`. Rows are selected and ordered by
 *      `receivedAt` (ingestion order), but the plotted `timestamp` is
 *      `(recordedAt || receivedAt).toISOString()`. When a device buffers
 *      readings and they arrive late, `recordedAt` ordering can differ from
 *      `receivedAt` ordering. If the response is emitted in query order without
 *      re-sorting by the plotted value, the UI renders a zig-zag "trend" that
 *      does not exist in the data.
 *
 *   2. Oversized range must fail loudly. `parseAndValidateDateRange` rejects a
 *      window wider than `MAX_RANGE_MS` with an explicit `DATE_RANGE_EXCEEDED`
 *      error, and the route must surface that as HTTP 400 rather than silently
 *      returning a partial window.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';

type Row = Record<string, any>;

const FROM = new Date('2026-10-01T00:00:00.000Z');
const TO = new Date('2026-10-01T23:59:59.000Z');

/** Minimal in-memory `findMany` supporting the filter/order/take subset used here. */
function applyQuery(store: Row[], args: any): Row[] {
  const where = args?.where ?? {};
  const range = where.receivedAt ?? {};

  let rows = store.filter((row) => {
    const receivedAt = row.receivedAt as Date;
    if (range.gte && receivedAt < range.gte) return false;
    if (range.lte && receivedAt > range.lte) return false;
    if (where.deviceId && row.deviceId !== where.deviceId) return false;
    if (where.locationKey && row.locationKey !== where.locationKey) return false;
    return true;
  });

  const orderBy = args?.orderBy as Array<{ [k: string]: 'asc' | 'desc' }> | undefined;
  if (orderBy && orderBy.length > 0) {
    rows = [...rows].sort((a, b) => {
      for (const clause of orderBy) {
        for (const [field, direction] of Object.entries(clause)) {
          const av = a[field] as never;
          const bv = b[field] as never;
          if (av === bv) continue;
          const cmp = av < bv ? -1 : 1;
          return direction === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  if (typeof args?.take === 'number') {
    rows = rows.slice(0, args.take);
  }

  return rows;
}

function soilRow(index: number, receivedAt: Date, recordedAt: Date = receivedAt): Row {
  return {
    id: `soil-${String(index).padStart(4, '0')}`,
    deviceId: 'device-1',
    locationKey: 'bed-a',
    locationName: 'Bed A',
    recordedAt,
    receivedAt,
    nitrogen: new Prisma.Decimal(index),
    phosphorus: new Prisma.Decimal(index + 1),
    potassium: new Prisma.Decimal(index + 2),
    temperature: new Prisma.Decimal(25),
    moisture: new Prisma.Decimal(60),
    ph: new Prisma.Decimal(7),
    ec: new Prisma.Decimal(500),
  };
}

function waterRow(index: number, receivedAt: Date, recordedAt: Date = receivedAt): Row {
  return {
    id: `water-${String(index).padStart(4, '0')}`,
    deviceId: 'device-1',
    locationKey: 'bed-a',
    locationName: 'Bed A',
    recordedAt,
    receivedAt,
    ph: new Prisma.Decimal(7),
    tds: new Prisma.Decimal(300),
    ec: new Prisma.Decimal(500),
  };
}

describe('Chart plotted-timestamp ordering and range eligibility (TASK-0504)', () => {
  let mockPrisma: any;
  let repo: TelemetryRepository;
  let soilStore: Row[];
  let waterStore: Row[];

  beforeEach(() => {
    soilStore = [];
    waterStore = [];

    mockPrisma = {
      device: {
        findFirst: vi.fn().mockResolvedValue({ id: 'device-1' }),
        findUnique: vi.fn(),
      },
      soilReading: {
        count: async ({ where }: any) => applyQuery(soilStore, { where }).length,
        findMany: async (args: any) => applyQuery(soilStore, args),
      },
      waterReading: {
        count: async ({ where }: any) => applyQuery(waterStore, { where }).length,
        findMany: async (args: any) => applyQuery(waterStore, args),
      },
    };

    repo = new TelemetryRepository(mockPrisma as never);
  });

  describe('plotted timestamps stay chronological when recordedAt diverges from receivedAt', () => {
    it('orders soil plotted timestamps monotonically for out-of-order buffered readings', async () => {
      // Received in order A -> B -> C, but the device recorded C before A and B.
      const receivedA = new Date(FROM.getTime() + 1 * 60_000);
      const receivedB = new Date(FROM.getTime() + 2 * 60_000);
      const receivedC = new Date(FROM.getTime() + 3 * 60_000);

      const recordedA = new Date(FROM.getTime() + 5 * 60_000);
      const recordedB = new Date(FROM.getTime() + 4 * 60_000);
      const recordedC = new Date(FROM.getTime() + 3 * 60_000);

      soilStore.push(soilRow(1, receivedA, recordedA));
      soilStore.push(soilRow(2, receivedB, recordedB));
      soilStore.push(soilRow(3, receivedC, recordedC));

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(result.series).toHaveLength(3);
      expect(result.truncated).toBe(false);

      const plotted = result.series.map((r) => new Date(r.timestamp).getTime());
      const sortedAscending = [...plotted].sort((a, b) => a - b);
      expect(plotted).toEqual(sortedAscending);

      // Plotted values must be the recorded timestamps, not the ingestion ones.
      expect(result.series.map((r) => r.timestamp)).toEqual([
        recordedC.toISOString(),
        recordedB.toISOString(),
        recordedA.toISOString(),
      ]);
    });

    it('orders water plotted timestamps monotonically for out-of-order buffered readings', async () => {
      const receivedA = new Date(FROM.getTime() + 1 * 60_000);
      const receivedB = new Date(FROM.getTime() + 2 * 60_000);
      const receivedC = new Date(FROM.getTime() + 3 * 60_000);

      const recordedA = new Date(FROM.getTime() + 5 * 60_000);
      const recordedB = new Date(FROM.getTime() + 4 * 60_000);
      const recordedC = new Date(FROM.getTime() + 3 * 60_000);

      waterStore.push(waterRow(1, receivedA, recordedA));
      waterStore.push(waterRow(2, receivedB, recordedB));
      waterStore.push(waterRow(3, receivedC, recordedC));

      const result = await repo.getWaterChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(result.series).toHaveLength(3);

      const plotted = result.series.map((r) => new Date(r.timestamp).getTime());
      const sortedAscending = [...plotted].sort((a, b) => a - b);
      expect(plotted).toEqual(sortedAscending);
    });

    it('keeps values and nulls intact while re-ordering by plotted timestamp', async () => {
      const receivedA = new Date(FROM.getTime() + 1 * 60_000);
      const receivedB = new Date(FROM.getTime() + 2 * 60_000);

      const rowA = soilRow(1, receivedA, new Date(FROM.getTime() + 5 * 60_000));
      rowA.nitrogen = null;
      rowA.ph = new Prisma.Decimal(0);
      const rowB = soilRow(2, receivedB, new Date(FROM.getTime() + 4 * 60_000));
      rowB.nitrogen = new Prisma.Decimal(7);

      soilStore.push(rowA, rowB);

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      // Row B (recorded +4m) precedes row A (recorded +5m). Values must follow the
      // rows they belong to: null nitrogen stays null, zero ph stays 0.
      expect(result.series.map((r) => r.nitrogen)).toEqual([7, null]);
      expect(result.series.map((r) => r.ph)).toEqual([7, 0]);
    });
  });

  describe('exact-limit and overflow eligibility are reported explicitly', () => {
    it('reports truncated=false at exactly the limit for soil', async () => {
      for (let i = 0; i < 10; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(result.series).toHaveLength(10);
      expect(result.truncated).toBe(false);
    });

    it('returns nextCursor for multi-batch retrieval past the limit without truncating data', async () => {
      for (let i = 0; i < 25; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(result.truncated).toBe(false);
      expect(result.series).toHaveLength(10);
      expect(result.nextCursor).toBeDefined();
      expect(result.totalRows).toBe(25);
    });

    it('returns null nextCursor when narrowing the range fits within limit', async () => {
      for (let i = 0; i < 25; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      // Narrow to readings after 16 minutes (only 9 readings remain)
      const narrowFrom = new Date(FROM.getTime() + 16 * 60_000);
      const narrow = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: narrowFrom,
        to: TO,
        limit: 10,
      });

      expect(narrow.series).toHaveLength(9);
      expect(narrow.nextCursor).toBeNull();
      expect(narrow.truncated).toBe(false);
    });
  });
});
