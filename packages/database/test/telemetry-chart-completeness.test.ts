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
  const range = where.receivedAt ?? {};

  let rows = store.filter((row) => {
    const receivedAt = row.receivedAt as Date;
    if (range.gte && receivedAt < range.gte) return false;
    if (range.lte && receivedAt > range.lte) return false;
    if (where.deviceId && row.deviceId !== where.deviceId) return false;
    if (where.locationKey && row.locationKey !== where.locationKey) return false;
    return true;
  });

  if (where.OR && Array.isArray(where.OR)) {
    rows = rows.filter((row) => {
      const receivedAt = row.receivedAt as Date;
      const id = row.id as string;
      return where.OR.some((clause: any) => {
        if (clause.receivedAt?.gt) {
          const gtDate =
            clause.receivedAt.gt instanceof Date
              ? clause.receivedAt.gt
              : new Date(clause.receivedAt.gt);
          if (receivedAt.getTime() > gtDate.getTime()) return true;
        }
        if (clause.receivedAt && !(clause.receivedAt as any).gt) {
          const eqDate =
            clause.receivedAt instanceof Date ? clause.receivedAt : new Date(clause.receivedAt);
          if (receivedAt.getTime() === eqDate.getTime() && clause.id?.gt && id > clause.id.gt) {
            return true;
          }
        }
        return false;
      });
    });
  }

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

function soilRow(index: number, receivedAt: Date): Row {
  return {
    id: `soil-${String(index).padStart(4, '0')}`,
    deviceId: 'device-1',
    locationKey: 'bed-a',
    locationName: 'Bed A',
    recordedAt: receivedAt,
    receivedAt,
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
  });
});
