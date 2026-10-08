import { describe, it, expect } from 'vitest';
import {
  SoilChartQuerySchema,
  WaterChartQuerySchema,
  ReadingLocationAnnotationSchema,
  ReadingIdSchema,
} from '@kebun-melon/contracts';

/**
 * Focused contract tests for the portable measurement-history feature.
 *
 * These cover the invariants that the UI relies on and that cannot be verified
 * by rendering alone:
 * - A chart request is impossible without an explicit location, so different
 *   locations can never be joined into one line.
 * - A blank location is rejected, and clearing is expressed as `null`, so a
 *   clear is never confused with a malformed request.
 * - Annotations address one immutable reading UUID, not a device.
 */

describe('SoilChartQuerySchema', () => {
  it('requires a location so no chart can span two physical places', () => {
    const result = SoilChartQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a blank location key', () => {
    const result = SoilChartQuerySchema.safeParse({ locationKey: '   ' });
    expect(result.success).toBe(false);
  });

  it('accepts a real location key with an optional window', () => {
    const result = SoilChartQuerySchema.safeParse({
      locationKey: 'bed a-1',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('WaterChartQuerySchema', () => {
  it('requires a location for the portable water device too', () => {
    expect(WaterChartQuerySchema.safeParse({}).success).toBe(false);
  });

  it('accepts a location key', () => {
    expect(WaterChartQuerySchema.safeParse({ locationKey: 'tandon-a' }).success).toBe(true);
  });
});

describe('ReadingLocationAnnotationSchema', () => {
  it('accepts null, which is how a location is cleared', () => {
    const result = ReadingLocationAnnotationSchema.safeParse({ locationName: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationName).toBeNull();
  });

  it('rejects a blank string instead of silently storing an empty location', () => {
    expect(ReadingLocationAnnotationSchema.safeParse({ locationName: '   ' }).success).toBe(false);
  });

  it('trims surrounding whitespace so identity is not fragmented', () => {
    const result = ReadingLocationAnnotationSchema.safeParse({ locationName: '  Bed A-1  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationName).toBe('Bed A-1');
  });
});

describe('ReadingIdSchema', () => {
  it('accepts a reading UUID', () => {
    expect(ReadingIdSchema.safeParse('3f2504e0-4f89-11d3-9a0c-0305e82c3301').success).toBe(true);
  });

  it('rejects a non-UUID so an annotation cannot target a whole device', () => {
    expect(ReadingIdSchema.safeParse('device-1').success).toBe(false);
  });
});
