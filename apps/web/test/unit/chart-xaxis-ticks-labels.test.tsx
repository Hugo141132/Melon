/**
 * Dedicated unit tests for X-Axis tick generation, responsive label distribution,
 * bilingual formatting (id/en), and clipping/overlap prevention (TASK-0504).
 */

import { describe, it, expect } from 'vitest';
import { getCustomXTicks, formatDayMonth } from '@/components/charts/NPKChart';

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
      expect(ticks[0]).toBe(data24[0].time);
      expect(ticks[ticks.length - 1]).toBe(data24[data24.length - 1].time);
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
          time: `${hh}:${mm}-${i}`, // unique time key
        };
      });

      const { ticks } = getCustomXTicks(data1001, '24h', 'id');
      expect(ticks).toHaveLength(6);
      // First tick is exactly data[0]
      expect(ticks[0]).toBe(data1001[0].time);
      // Last tick is exactly data[1000]
      expect(ticks[5]).toBe(data1001[1000].time);
      // Unique ticks without overlap
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

      // Verify no adjacent day labels
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
  });
});
