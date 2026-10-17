/**
 * Regression tests for chart keyset cursor pagination & completeness (TASK-0503 / TASK-0504).
 *
 * Validates bounded keyset pagination on `[receivedAt, id]`:
 * - Multi-batch retrieval yields 100% of matching readings without missing rows or duplicates.
 * - `nextCursor` accurately points to the last row of the batch and terminates with `null`.
 * - Chronological ordering is preserved.
 * - Exact-limit and zero/null values survive untouched.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { TelemetryRepository } from '../src/telemetry-repository';

type Row = Record<string, unknown>;

const FROM = new Date('2026-10-01T00:00:00Z');
const TO = new Date('2026-10-02T00:00:00Z');

/**
 * Applies the subset of Prisma query semantics this repository relies on:
 * `where.receivedAt.gte/lte`, multi-key `orderBy`, `take`, and keyset `where.OR`.
 */
function applyQuery(store: Row[], args: any): Row[] {
  const where = args?.where ?? {};
  let timeRangeFilter: any = null;
  let cursorFilter: any = null;

  if (where.AND && Array.isArray(where.AND)) {
    for (const clause of where.AND) {
      if (clause.OR && Array.isArray(clause.OR)) {
        const isTimeRange = clause.OR.some((c: any) => c.recordedAt?.gte || c.receivedAt?.gte);
        if (isTimeRange) {
          timeRangeFilter = clause.OR;
        } else {
          cursorFilter = clause.OR;
        }
      }
    }
  }

  let rows = store.filter((row) => {
    if (where.deviceId && row.deviceId !== where.deviceId) return false;
    if (where.locationKey && row.locationKey !== where.locationKey) return false;

    // Evaluate timeRangeFilter: OR: [{ recordedAt: [gte, lt) }, { recordedAt: null, receivedAt: [gte, lt) }]
    if (timeRangeFilter) {
      const matchesTime = timeRangeFilter.some((clause: any) => {
        if (clause.recordedAt && !clause.receivedAt) {
          const recAt = row.recordedAt as Date | null;
          if (!recAt) return false;
          if (clause.recordedAt.gte && recAt < clause.recordedAt.gte) return false;
          if (clause.recordedAt.lt && recAt >= clause.recordedAt.lt) return false;
          return true;
        }
        if (clause.recordedAt === null && clause.receivedAt) {
          if (row.recordedAt !== null) return false;
          const recAt = row.receivedAt as Date;
          if (clause.receivedAt.gte && recAt < clause.receivedAt.gte) return false;
          if (clause.receivedAt.lt && recAt >= clause.receivedAt.lt) return false;
          return true;
        }
        return false;
      });
      if (!matchesTime) return false;
    }

    // Evaluate cursorFilter: OR: [{ receivedAt: { gt } }, { receivedAt: date, id: { gt } }]
    if (cursorFilter) {
      const matchesCursor = cursorFilter.some((clause: any) => {
        const recAt = row.receivedAt as Date;
        if (clause.receivedAt?.gt) {
          const gtDate =
            clause.receivedAt.gt instanceof Date
              ? clause.receivedAt.gt
              : new Date(clause.receivedAt.gt);
          return recAt.getTime() > gtDate.getTime();
        }
        if (clause.receivedAt && !(clause.receivedAt as any).gt && clause.id?.gt) {
          const eqDate =
            clause.receivedAt instanceof Date ? clause.receivedAt : new Date(clause.receivedAt);
          return recAt.getTime() === eqDate.getTime() && (row.id as string) > clause.id.gt;
        }
        return false;
      });
      if (!matchesCursor) return false;
    }

    return true;
  });

  const orderBy = args?.orderBy as Array<{ [k: string]: 'asc' | 'desc' }> | undefined;
  if (orderBy && orderBy.length > 0) {
    rows = [...rows].sort((a, b) => {
      for (const clause of orderBy) {
        for (const [field, direction] of Object.entries(clause)) {
          const av = (a[field] instanceof Date ? (a[field] as Date).getTime() : a[field]) as never;
          const bv = (b[field] instanceof Date ? (b[field] as Date).getTime() : b[field]) as never;
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

function soilRow(index: number, dateOrRecordedAt: Date, receivedAt?: Date, customId?: string): Row {
  const recAt = dateOrRecordedAt;
  const recvAt = receivedAt !== undefined ? receivedAt : dateOrRecordedAt;
  return {
    id: customId ?? `soil-${String(index).padStart(4, '0')}`,
    deviceId: 'device-1',
    locationKey: 'bed-a',
    locationName: 'Bed A',
    recordedAt: recAt,
    receivedAt: recvAt,
    nitrogen: new Prisma.Decimal(index),
    phosphorus: new Prisma.Decimal(index + 1),
    potassium: new Prisma.Decimal(index + 2),
    temperature: new Prisma.Decimal(25),
    moisture: new Prisma.Decimal(60),
    ph: new Prisma.Decimal(6.5),
    ec: new Prisma.Decimal(1.1),
  };
}

function waterRow(index: number, receivedAt: Date): Row {
  return {
    id: `water-${String(index).padStart(4, '0')}`,
    deviceId: 'device-1',
    locationKey: 'bed-a',
    locationName: 'Bed A',
    recordedAt: receivedAt,
    receivedAt,
    ph: new Prisma.Decimal(7),
    tds: new Prisma.Decimal(300),
    ec: new Prisma.Decimal(500),
  };
}

describe('TelemetryRepository chart keyset pagination & completeness (TASK-0504)', () => {
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
        update: vi.fn(),
      },
      soilReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(async (args: any) => applyQuery(soilStore, args).length),
        findMany: vi.fn(async (args: any) => applyQuery(soilStore, args)),
      },
      waterReading: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(async (args: any) => applyQuery(waterStore, args).length),
        findMany: vi.fn(async (args: any) => applyQuery(waterStore, args)),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
      $executeRaw: vi.fn().mockResolvedValue(0),
    };

    repo = new TelemetryRepository(mockPrisma as any);
  });

  describe('getSoilChartSeries', () => {
    it('retrieves complete dataset across multiple keyset batches without loss or duplication', async () => {
      // 25 rows with a batch limit of 10 -> exactly 3 batches (10 + 10 + 5)
      for (let i = 0; i < 25; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      // Batch 1
      const batch1 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(batch1.series).toHaveLength(10);
      expect(batch1.nextCursor).toBeDefined();
      expect(batch1.totalRows).toBe(25);
      expect(batch1.series.map((r) => r.readingId)).toEqual(
        Array.from({ length: 10 }, (_, i) => `soil-${String(i).padStart(4, '0')}`)
      );

      // Batch 2
      const batch2 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
        cursor: batch1.nextCursor,
      });

      expect(batch2.series).toHaveLength(10);
      expect(batch2.nextCursor).toBeDefined();
      expect(batch2.series.map((r) => r.readingId)).toEqual(
        Array.from({ length: 10 }, (_, i) => `soil-${String(i + 10).padStart(4, '0')}`)
      );

      // Batch 3
      const batch3 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
        cursor: batch2.nextCursor,
      });

      expect(batch3.series).toHaveLength(5);
      expect(batch3.nextCursor).toBeNull(); // Terminal batch
      expect(batch3.series.map((r) => r.readingId)).toEqual(
        Array.from({ length: 5 }, (_, i) => `soil-${String(i + 20).padStart(4, '0')}`)
      );

      // Total aggregated points must equal exactly all 25 rows
      const combined = [...batch1.series, ...batch2.series, ...batch3.series];
      expect(combined).toHaveLength(25);
      expect(new Set(combined.map((r) => r.readingId)).size).toBe(25);
    });

    it('keeps chronological order across the returned window', async () => {
      for (let i = 0; i < 15; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 20,
      });

      const timestamps = result.series.map((r) => new Date(r.timestamp).getTime());
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      expect(result.series).toHaveLength(15);
      expect(result.nextCursor).toBeNull();
    });

    it('selects deterministically when timestamps are equal', async () => {
      const sameTime = new Date('2026-10-01T12:00:00Z');
      for (let i = 0; i < 10; i += 1) {
        soilStore.push(soilRow(i, sameTime));
      }

      const args = {
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 5,
      };
      const first = await repo.getSoilChartSeries(args);
      const second = await repo.getSoilChartSeries(args);

      expect(first.series.map((r) => r.readingId)).toEqual(second.series.map((r) => r.readingId));
      expect(first.series.map((r) => r.readingId)).toEqual([
        'soil-0000',
        'soil-0001',
        'soil-0002',
        'soil-0003',
        'soil-0004',
      ]);
    });

    it('preserves null and zero values inside the displayed window', async () => {
      const base = new Date(FROM.getTime() + 60_000);
      const rows = [soilRow(0, base), soilRow(1, base), soilRow(2, base)];
      rows[0].nitrogen = new Prisma.Decimal(0);
      rows[0].phosphorus = null;
      rows[1].nitrogen = null;
      rows[1].temperature = new Prisma.Decimal(0);
      rows[2].nitrogen = null;
      rows[2].moisture = null;
      soilStore.push(...rows);

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 3,
      });

      expect(result.series.map((r) => r.nitrogen)).toEqual([0, null, null]);
      expect(result.series.map((r) => r.phosphorus)).toEqual([null, 2, 3]);
      expect(result.series.map((r) => r.temperature)).toEqual([25, 0, 25]);
      expect(result.series.map((r) => r.moisture)).toEqual([60, 60, null]);
    });

    it('only returns rows for the requested location', async () => {
      for (let i = 0; i < 8; i += 1) {
        soilStore.push(soilRow(i, new Date(FROM.getTime() + i * 60_000)));
      }
      for (let i = 0; i < 8; i += 1) {
        const other = soilRow(100 + i, new Date(FROM.getTime() + i * 60_000));
        other.locationKey = 'bed-b';
        other.locationName = 'Bed B';
        soilStore.push(other);
      }

      const result = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 20,
      });

      expect(result.series).toHaveLength(8);
      expect(result.locationKey).toBe('bed-a');
      expect(result.locationName).toBe('Bed A');
      expect(result.series.every((r) => !r.readingId.startsWith('soil-010'))).toBe(true);
    });

    it('rejects malformed or invalid pagination cursor with an explicit error', async () => {
      await expect(
        repo.getSoilChartSeries({
          deviceIdentifier: 'device-1',
          locationKey: 'bed-a',
          from: FROM,
          to: TO,
          cursor: 'invalid-cursor-without-separator',
        })
      ).rejects.toThrow('Invalid or malformed pagination cursor.');

      await expect(
        repo.getSoilChartSeries({
          deviceIdentifier: 'device-1',
          locationKey: 'bed-a',
          from: FROM,
          to: TO,
          cursor: 'not-a-date_some-id',
        })
      ).rejects.toThrow('Invalid or malformed pagination cursor.');
    });
  });

  describe('getWaterChartSeries', () => {
    it('retrieves multi-batch water quality data seamlessly via cursor', async () => {
      for (let i = 0; i < 15; i += 1) {
        waterStore.push(waterRow(i, new Date(FROM.getTime() + i * 60_000)));
      }

      const b1 = await repo.getWaterChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
      });

      expect(b1.series).toHaveLength(10);
      expect(b1.nextCursor).toBeDefined();

      const b2 = await repo.getWaterChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 10,
        cursor: b1.nextCursor,
      });

      expect(b2.series).toHaveLength(5);
      expect(b2.nextCursor).toBeNull();

      const combined = [...b1.series, ...b2.series];
      expect(combined).toHaveLength(15);
      expect(new Set(combined.map((r) => r.readingId)).size).toBe(15);
    });

    it('correctly includes reading with delayed ingestion and excludes reading beyond boundary', async () => {
      // Custom range: Oct 10 00:00 WIB to Oct 11 00:00 WIB
      const customFrom = new Date('2026-10-09T17:00:00.000Z');
      const customTo = new Date('2026-10-10T17:00:00.000Z');

      // Row 1: recorded at Oct 10 23:59 WIB, received at Oct 11 00:01 WIB
      waterStore.push({
        id: 'water-delayed-1',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: new Date('2026-10-10T16:59:00.000Z'), // 23:59 WIB
        receivedAt: new Date('2026-10-10T17:01:00.000Z'), // 00:01 WIB next day
        ph: new Prisma.Decimal(7),
        tds: new Prisma.Decimal(300),
        ec: new Prisma.Decimal(500),
      });

      // Row 2: recorded at Oct 11 00:14 WIB, received at Oct 11 00:15 WIB
      waterStore.push({
        id: 'water-nextday-2',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: new Date('2026-10-10T17:14:00.000Z'), // 00:14 WIB next day
        receivedAt: new Date('2026-10-10T17:15:00.000Z'), // 00:15 WIB next day
        ph: new Prisma.Decimal(7.1),
        tds: new Prisma.Decimal(310),
        ec: new Prisma.Decimal(510),
      });

      const res = await repo.getWaterChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: customFrom,
        to: customTo,
      });

      const ids = res.series.map((s) => s.readingId);
      // Row 1 MUST be included because recordedAt is within [customFrom, customTo)
      expect(ids).toContain('water-delayed-1');
      // Row 2 MUST NOT be included because recordedAt is >= customTo
      expect(ids).not.toContain('water-nextday-2');
    });

    it('faithfully paginates across batches with interleaved NULL/non-NULL recordedAt and delayed uploads without skipping or duplicating', async () => {
      // Setup 5 rows within [FROM, TO):
      // Row 1: recordedAt 10:00, receivedAt 10:05
      // Row 2: recordedAt NULL, receivedAt 10:06 (un-clocked reading)
      // Row 3: recordedAt 09:50 (delayed upload), receivedAt 10:07
      // Row 4: recordedAt NULL, receivedAt 10:08 (un-clocked reading)
      // Row 5: recordedAt 10:20, receivedAt 10:09
      soilStore.push({
        id: 'soil-interleave-1',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: new Date('2026-10-01T10:00:00.000Z'),
        receivedAt: new Date('2026-10-01T10:05:00.000Z'),
        nitrogen: new Prisma.Decimal(10),
      });
      soilStore.push({
        id: 'soil-interleave-2',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: null,
        receivedAt: new Date('2026-10-01T10:06:00.000Z'),
        nitrogen: new Prisma.Decimal(20),
      });
      soilStore.push({
        id: 'soil-interleave-3',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: new Date('2026-10-01T09:50:00.000Z'),
        receivedAt: new Date('2026-10-01T10:07:00.000Z'),
        nitrogen: new Prisma.Decimal(30),
      });
      soilStore.push({
        id: 'soil-interleave-4',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: null,
        receivedAt: new Date('2026-10-01T10:08:00.000Z'),
        nitrogen: new Prisma.Decimal(40),
      });
      soilStore.push({
        id: 'soil-interleave-5',
        deviceId: 'device-1',
        locationKey: 'bed-a',
        locationName: 'Bed A',
        recordedAt: new Date('2026-10-01T10:20:00.000Z'),
        receivedAt: new Date('2026-10-01T10:09:00.000Z'),
        nitrogen: new Prisma.Decimal(50),
      });

      // Batch 1 (limit 2)
      const b1 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
      });

      // Retrieval is strictly ordered by receivedAt ASC, id ASC
      // Rows fetched: soil-interleave-1 (10:05), soil-interleave-2 (10:06)
      expect(b1.series.map((s) => s.readingId)).toEqual(['soil-interleave-1', 'soil-interleave-2']);
      expect(b1.nextCursor).toBe(`2026-10-01T10:06:00.000Z_soil-interleave-2`);

      // Batch 2 (limit 2)
      const b2 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
        cursor: b1.nextCursor,
      });

      // Rows fetched: soil-interleave-3 (10:07), soil-interleave-4 (10:08)
      // Display ordering sorts by (recordedAt ?? receivedAt): soil-interleave-3 (09:50) before soil-interleave-4 (10:08)
      expect(b2.series.map((s) => s.readingId)).toEqual(['soil-interleave-3', 'soil-interleave-4']);
      expect(b2.nextCursor).toBe(`2026-10-01T10:08:00.000Z_soil-interleave-4`);

      // Batch 3 (limit 2)
      const b3 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
        cursor: b2.nextCursor,
      });

      // Rows fetched: soil-interleave-5 (10:09)
      expect(b3.series.map((s) => s.readingId)).toEqual(['soil-interleave-5']);
      expect(b3.nextCursor).toBeNull();

      // Combined dataset has 100% complete set of expected IDs without skipping or duplicates
      const allFetchedIds = [...b1.series, ...b2.series, ...b3.series].map((s) => s.readingId);
      expect(allFetchedIds).toEqual([
        'soil-interleave-1',
        'soil-interleave-2',
        'soil-interleave-3',
        'soil-interleave-4',
        'soil-interleave-5',
      ]);

      // When sorted for final client chart plotting by (recordedAt ?? receivedAt):
      // Row 3 (09:50), Row 1 (10:00), Row 2 (10:06), Row 4 (10:08), Row 5 (10:20)
      const plottingOrder = [...b1.series, ...b2.series, ...b3.series]
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        .map((s) => s.readingId);

      expect(plottingOrder).toEqual([
        'soil-interleave-3',
        'soil-interleave-1',
        'soil-interleave-2',
        'soil-interleave-4',
        'soil-interleave-5',
      ]);
    });

    it('proves global sorting: later retrieval batch containing earlier sensor timestamps sorts into correct global order with deterministic tie-breaker', async () => {
      const FROM = new Date('2026-10-01T00:00:00.000Z');
      const TO = new Date('2026-10-01T23:59:59.999Z');

      // Batch 1 records (received earlier, but have later sensor timestamps)
      soilStore.push(
        soilRow(
          1,
          new Date('2026-10-01T10:00:00.000Z'),
          new Date('2026-10-01T10:00:00.000Z'),
          'soil-b1-rec-1'
        ),
        soilRow(
          2,
          new Date('2026-10-01T10:01:00.000Z'),
          new Date('2026-10-01T10:01:00.000Z'),
          'soil-b1-rec-2'
        )
      );

      // Batch 2 records (delayed upload: received later, but have earlier sensor timestamps)
      soilStore.push(
        soilRow(
          3,
          new Date('2026-10-01T09:30:00.000Z'),
          new Date('2026-10-01T10:02:00.000Z'),
          'soil-b2-early-sensor-b'
        ),
        soilRow(
          4,
          new Date('2026-10-01T09:30:00.000Z'),
          new Date('2026-10-01T10:03:00.000Z'),
          'soil-b2-early-sensor-a'
        )
      );

      // Batch 1 (limit 2)
      const b1 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
      });

      expect(b1.series.map((s) => s.readingId)).toEqual(['soil-b1-rec-1', 'soil-b1-rec-2']);
      expect(b1.nextCursor).toBe(`2026-10-01T10:01:00.000Z_soil-b1-rec-2`);

      // Batch 2 (limit 2 with cursor)
      const b2 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
        cursor: b1.nextCursor,
      });

      // Retrieval preserves keyset ordering on [receivedAt, id] mapped through series ordering
      expect(b2.series.map((s) => s.readingId)).toEqual([
        'soil-b2-early-sensor-a',
        'soil-b2-early-sensor-b',
      ]);
      expect(b2.nextCursor).toBeDefined();

      // Batch 3 (limit 2 with cursor) verifies clean termination
      const b3 = await repo.getSoilChartSeries({
        deviceIdentifier: 'device-1',
        locationKey: 'bed-a',
        from: FROM,
        to: TO,
        limit: 2,
        cursor: b2.nextCursor,
      });
      expect(b3.series).toHaveLength(0);
      expect(b3.nextCursor).toBeNull();

      // Combined dataset contains 100% of rows
      const combined = [...b1.series, ...b2.series];
      expect(combined.map((s) => s.readingId)).toEqual([
        'soil-b1-rec-1',
        'soil-b1-rec-2',
        'soil-b2-early-sensor-a',
        'soil-b2-early-sensor-b',
      ]);

      // Client-side global sort across all accumulated batches with deterministic ID tie-breaker
      const globallySorted = combined.sort((a, b) => {
        const at = new Date(a.recordedAt).getTime();
        const bt = new Date(b.recordedAt).getTime();
        if (at !== bt) return at - bt;
        return a.readingId.localeCompare(b.readingId);
      });

      // Expected global order: 09:30:00 (a then b via ID tie-breaker), then 10:00:00, then 10:01:00
      expect(globallySorted.map((s) => s.readingId)).toEqual([
        'soil-b2-early-sensor-a',
        'soil-b2-early-sensor-b',
        'soil-b1-rec-1',
        'soil-b1-rec-2',
      ]);
    });
  });
});
