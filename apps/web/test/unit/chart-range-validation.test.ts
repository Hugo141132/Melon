/**
 * API-level proof that an oversized chart range yields an explicit, actionable
 * validation state instead of an incomplete trend (TASK-0504, DEC-MON-087).
 *
 * The chart routes accept `from`/`to` query parameters. `MAX_RANGE_MS` is
 * enforced server-side so a caller cannot bypass the UI control and receive a
 * silently truncated window that looks complete. These tests pin that contract
 * for both soil and water, plus the boundary and the recovery path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequireActiveAccount = vi.fn();
const mockRequirePermission = vi.fn();
const mockGetSessionOrNull = vi.fn();
const mockGetSoilChartSeries = vi.fn();
const mockGetWaterChartSeries = vi.fn();
const mockGetSoilReadingLocations = vi.fn();
const mockGetWaterReadingLocations = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  TelemetryRepository: class {
    getSoilChartSeries = mockGetSoilChartSeries;
    getWaterChartSeries = mockGetWaterChartSeries;
    getSoilReadingLocations = mockGetSoilReadingLocations;
    getWaterReadingLocations = mockGetWaterReadingLocations;
  },
}));

vi.mock('@/lib/auth/rbac', () => ({
  getSessionOrNull: mockGetSessionOrNull,
  requireActiveAccount: mockRequireActiveAccount,
  requirePermission: mockRequirePermission,
  AuthorizationError: class AuthorizationError extends Error {},
}));

const { parseAndValidateDateRange, MAX_RANGE_MS } = await import('@/lib/monitoring/date-range');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Chart date-range validation is an explicit server-side state (TASK-0504)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes a 31-day bound matching DEC-MON-087', () => {
    expect(MAX_RANGE_MS).toBe(31 * DAY_MS);
  });

  it('accepts a range exactly at the limit', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date(from.getTime() + MAX_RANGE_MS);
    const result = parseAndValidateDateRange(from.toISOString(), to.toISOString());

    expect(result.errorResponse).toBeUndefined();
    expect(result.from?.toISOString()).toBe(from.toISOString());
    expect(result.to?.toISOString()).toBe(to.toISOString());
  });

  it('rejects one millisecond past the limit with an actionable 400', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date(from.getTime() + MAX_RANGE_MS + 1);
    const result = parseAndValidateDateRange(from.toISOString(), to.toISOString());

    expect(result.errorResponse?.statusCode).toBe(400);
    expect(result.errorResponse?.code).toBe('DATE_RANGE_EXCEEDED');
    // The message must state the bound so an operator can act on it.
    expect(result.errorResponse?.message).toContain('31 days');
    // Critically, no partial range leaks through for the chart to render.
    expect(result.from).toBeUndefined();
    expect(result.to).toBeUndefined();
  });

  it('rejects a grossly oversized range rather than returning a partial window', () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    const to = new Date('2026-10-01T00:00:00.000Z');
    const result = parseAndValidateDateRange(from.toISOString(), to.toISOString());

    expect(result.errorResponse?.code).toBe('DATE_RANGE_EXCEEDED');
    expect(result.from).toBeUndefined();
  });

  it('recovers and returns data once the range is narrowed back under the limit', () => {
    const wide = parseAndValidateDateRange('2026-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    expect(wide.errorResponse).toBeDefined();

    const narrowed = parseAndValidateDateRange(
      '2026-09-20T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );
    expect(narrowed.errorResponse).toBeUndefined();
    expect(narrowed.from).toBeInstanceOf(Date);
    expect(narrowed.to).toBeInstanceOf(Date);
  });

  it('rejects malformed or inverted ranges with an explicit error, not silent fallback', () => {
    const malformed = parseAndValidateDateRange('not-a-date', '2026-10-01T00:00:00.000Z');
    expect(malformed.errorResponse?.statusCode).toBe(400);

    const inverted = parseAndValidateDateRange(
      '2026-10-02T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );
    expect(inverted.errorResponse?.statusCode).toBe(400);
  });
});
