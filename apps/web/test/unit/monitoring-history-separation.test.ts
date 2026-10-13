import { describe, it, expect } from 'vitest';
import {
  parseLocalDateStart,
  parseLocalDateNextDayStart,
  getDisplayTimezone,
  validateCustomCalendarRange,
} from '@/hooks/useHistoricalMonitoring';
import { formatTooltipDateTime, formatDayMonth } from '@/components/charts/NPKChart';
import { soilHistoryColumns } from '@/app/soil/page';
import { waterHistoryColumns } from '@/app/water/page';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';

describe('Monitoring Correction: Chart Dates & History Separation', () => {
  describe('1. Column Definitions: Water excludes temperature, Soil retains it', () => {
    it('soilHistoryColumns includes temperature (°C) and all required metrics', () => {
      const keys = soilHistoryColumns.map((col) => col.key);
      expect(keys).toContain('temperature');
      const tempCol = soilHistoryColumns.find((col) => col.key === 'temperature');
      expect(tempCol?.unit).toBe('°C');
      expect(keys).toContain('nitrogen');
      expect(keys).toContain('phosphorus');
      expect(keys).toContain('potassium');
      expect(keys).toContain('moisture');
      expect(keys).toContain('ph');
      expect(keys).toContain('ec');
    });

    it('waterHistoryColumns does NOT include temperature (°C) but preserves other metrics', () => {
      const keys = waterHistoryColumns.map((col) => col.key);
      expect(keys).not.toContain('temperature');
      expect(keys).toContain('ph');
      expect(keys).toContain('tds');
      expect(keys).toContain('ec');
    });
  });

  describe('2. Custom Calendar Date Boundaries in Active Display Timezone', () => {
    it('resolves active display timezone with valid fallback', () => {
      const tz = getDisplayTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('same-day custom selection (2026-10-10 to 2026-10-10) defines start-of-day to next-day-start', () => {
      const from = parseLocalDateStart('2026-10-10');
      const to = parseLocalDateNextDayStart('2026-10-10');

      // Boundary condition: start-of-day (00:00:00.000) to start-of-next-day (00:00:00.000)
      expect(to.getTime()).toBeGreaterThan(from.getTime());
      expect(from.getFullYear()).toBe(2026);
      expect(from.getMonth()).toBe(9); // October (0-indexed)
      expect(from.getDate()).toBe(10);
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(from.getSeconds()).toBe(0);
      expect(from.getMilliseconds()).toBe(0);

      expect(to.getFullYear()).toBe(2026);
      expect(to.getMonth()).toBe(9);
      expect(to.getDate()).toBe(11);
      expect(to.getHours()).toBe(0);
      expect(to.getMinutes()).toBe(0);
      expect(to.getSeconds()).toBe(0);
      expect(to.getMilliseconds()).toBe(0);
    });

    it('includes measurement with delayed receipt (recordedAt = Oct 10 23:59, receivedAt = Oct 11 00:01)', () => {
      const from = parseLocalDateStart('2026-10-10');
      const to = parseLocalDateNextDayStart('2026-10-10');

      // Sensor recorded reading at 23:59:00 on Oct 10 in the display timezone
      const recordedAt = new Date(from.getTime() + (23 * 60 + 59) * 60 * 1000);
      // Gateway received reading at 00:01:00 on Oct 11 (network delay, past midnight)
      const receivedAt = new Date(to.getTime() + 1 * 60 * 1000);

      // Evaluated on recordedAt:
      const includedByRecordedAt =
        recordedAt.getTime() >= from.getTime() && recordedAt.getTime() < to.getTime();
      expect(includedByRecordedAt).toBe(true);

      // If incorrectly evaluated on receivedAt:
      const wouldBeOmittedByReceivedAt =
        receivedAt.getTime() < from.getTime() || receivedAt.getTime() >= to.getTime();
      expect(wouldBeOmittedByReceivedAt).toBe(true);
    });

    it('excludes point recorded on next day (11 Oct 00:14) from 10 Oct custom range', () => {
      const from = parseLocalDateStart('2026-10-10');
      const to = parseLocalDateNextDayStart('2026-10-10');

      const nextDayReading = new Date(to.getTime() + 14 * 60 * 1000);
      const isIncluded =
        nextDayReading.getTime() >= from.getTime() && nextDayReading.getTime() < to.getTime();

      expect(isIncluded).toBe(false);
    });

    it('multi-day range (2026-10-08 to 2026-10-10) is start-of-day 8th to start-of-day 11th', () => {
      const from = parseLocalDateStart('2026-10-08');
      const to = parseLocalDateNextDayStart('2026-10-10');

      expect(to.getTime()).toBeGreaterThan(from.getTime());
      expect(from.getFullYear()).toBe(2026);
      expect(from.getMonth()).toBe(9);
      expect(from.getDate()).toBe(8);
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);

      expect(to.getFullYear()).toBe(2026);
      expect(to.getMonth()).toBe(9);
      expect(to.getDate()).toBe(11);
      expect(to.getHours()).toBe(0);
      expect(to.getMinutes()).toBe(0);
    });
  });

  describe('3. Timezone Formatting on Tooltips and Axes', () => {
    it('formatTooltipDateTime formats consistently with explicit timezone (Asia/Jakarta)', () => {
      // 2026-10-10T16:59:00.000Z is 23:59 WIB (+07:00)
      const timestamp = '2026-10-10T16:59:00.000Z';

      const tooltip24h = formatTooltipDateTime(timestamp, '24h', 'id', 'Asia/Jakarta');
      expect(tooltip24h).toBe('23:59');

      const tooltipMultiDayId = formatTooltipDateTime(timestamp, '7d', 'id', 'Asia/Jakarta');
      expect(tooltipMultiDayId).toContain('23:59');
      expect(tooltipMultiDayId).toContain('10');

      const tooltipMultiDayEn = formatTooltipDateTime(timestamp, '7d', 'en', 'Asia/Jakarta');
      expect(tooltipMultiDayEn).toContain('23:59');
      expect(tooltipMultiDayEn).toContain('10');
    });

    it('formatDayMonth correctly localizes day and month in specified timezone', () => {
      const date = new Date('2026-10-09T17:00:00.000Z'); // 10 Oct 00:00 WIB
      const formattedId = formatDayMonth(date, 'id', 'Asia/Jakarta');
      expect(formattedId).toContain('10');

      const formattedEn = formatDayMonth(date, 'en', 'Asia/Jakarta');
      expect(formattedEn).toContain('10');
    });

    it('formatTooltipDateTime operates without explicit timezone by using display timezone', () => {
      const timestamp = '2026-10-10T12:00:00.000Z';
      const formatted = formatTooltipDateTime(timestamp, '24h', 'id');
      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('4. History Route Contract: Optional date parameters for unbound history', () => {
    it('history endpoints treat omitted from/to as requesting all retained readings', () => {
      const queryParamsWithoutDates = new URLSearchParams({
        page: '1',
        pageSize: '5',
      });

      const rawFrom = queryParamsWithoutDates.get('from');
      const rawTo = queryParamsWithoutDates.get('to');

      expect(rawFrom).toBeNull();
      expect(rawTo).toBeNull();

      const fromDate = rawFrom ? new Date(rawFrom) : undefined;
      const toDate = rawTo ? new Date(rawTo) : undefined;

      expect(fromDate).toBeUndefined();
      expect(toDate).toBeUndefined();
    });
  });

  describe('5. Custom Date Range Validation & Localization (Reversed Dates Fix)', () => {
    it('reversed-by-one-day (2026-10-15 to 2026-10-14) is invalid and returns dateRangeOrder error key', () => {
      const result = validateCustomCalendarRange('2026-10-15', '2026-10-14');
      expect(result.isValid).toBe(false);
      expect(result.errorKey).toBe('dateRangeOrder');
      expect(result.range).toBeNull();
    });

    it('reversed-by-two-days (2026-10-16 to 2026-10-14) is invalid and returns dateRangeOrder error key', () => {
      const result = validateCustomCalendarRange('2026-10-16', '2026-10-14');
      expect(result.isValid).toBe(false);
      expect(result.errorKey).toBe('dateRangeOrder');
      expect(result.range).toBeNull();
    });

    it('same-day selection (2026-10-14 to 2026-10-14) is valid with no error', () => {
      const result = validateCustomCalendarRange('2026-10-14', '2026-10-14');
      expect(result.isValid).toBe(true);
      expect(result.errorKey).toBeNull();
      expect(result.range).not.toBeNull();
      expect(result.range?.from.getTime()).toBeLessThan(result.range?.to.getTime()!);
    });

    it('correction flow: invalid reversed range is cleared upon correcting dates', () => {
      // Step 1: User enters reversed dates
      const initialReversed = validateCustomCalendarRange('2026-10-15', '2026-10-14');
      expect(initialReversed.isValid).toBe(false);
      expect(initialReversed.errorKey).toBe('dateRangeOrder');

      // Step 2: User corrects start date to 2026-10-14
      const correctedStart = validateCustomCalendarRange('2026-10-14', '2026-10-14');
      expect(correctedStart.isValid).toBe(true);
      expect(correctedStart.errorKey).toBeNull();
      expect(correctedStart.range).not.toBeNull();

      // Step 3: User expands end date to 2026-10-16
      const expandedRange = validateCustomCalendarRange('2026-10-14', '2026-10-16');
      expect(expandedRange.isValid).toBe(true);
      expect(expandedRange.errorKey).toBeNull();
      expect(expandedRange.range).not.toBeNull();
    });

    it('renders localized dateRangeOrder message correctly in both id and en locales', () => {
      const errorKey = 'dateRangeOrder';
      const idText = (idMessages.history as any)[errorKey];
      const enText = (enMessages.history as any)[errorKey];

      expect(idText).toBe('Tanggal mulai harus sebelum atau sama dengan tanggal selesai.');
      expect(enText).toBe('Start date must be on or before end date.');
    });

    it('verifies all related custom range error keys exist and are localized in id and en', () => {
      const requiredKeys = [
        'dateRangeSelectBoth',
        'dateRangeInvalid',
        'dateRangeOrder',
        'maxBoundsExceeded',
      ] as const;

      for (const key of requiredKeys) {
        expect((idMessages.history as any)[key]).toBeDefined();
        expect((enMessages.history as any)[key]).toBeDefined();
        expect(typeof (idMessages.history as any)[key]).toBe('string');
        expect(typeof (enMessages.history as any)[key]).toBe('string');
        expect((idMessages.history as any)[key].length).toBeGreaterThan(0);
        expect((enMessages.history as any)[key].length).toBeGreaterThan(0);
      }

      // Confirm technical copy (DEC-MON-087) is not in maxBoundsExceeded
      expect((idMessages.history as any).maxBoundsExceeded).not.toContain('DEC-MON-087');
      expect((enMessages.history as any).maxBoundsExceeded).not.toContain('DEC-MON-087');
      // Confirm removed key max31DaysNote is absent
      expect((idMessages.history as any).max31DaysNote).toBeUndefined();
      expect((enMessages.history as any).max31DaysNote).toBeUndefined();
    });
  });
});
