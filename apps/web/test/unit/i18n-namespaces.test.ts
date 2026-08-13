import { describe, expect, it } from 'vitest';
import idMessages from '../../messages/id.json';
import enMessages from '../../messages/en.json';

const REQUIRED_NAMESPACES = [
  'common',
  'auth',
  'navigation',
  'dashboard',
  'devices',
  'soil',
  'water',
  'history',
  'faucet',
  'alerts',
  'users',
  'approvals',
  'profile',
  'settings',
  'validation',
  'errors',
  'accessibility',
] as const;

/**
 * Helper to recursively extract all key paths from a nested object.
 * e.g., { common: { save: "Save" } } => ["common.save"]
 */
function getAllKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeyPaths(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

/**
 * Helper to get a nested value by dot-notated key path.
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Extract ICU/next-intl interpolation placeholders like {time}, {count}, {volume} from a string.
 */
function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{[a-zA-Z0-9_]+\}/g);
  return matches ? matches.sort() : [];
}

describe('TASK-0602: Translation Namespaces and Key Parity', () => {
  it('should contain all 17 required namespaces in both id.json and en.json', () => {
    const idKeys = Object.keys(idMessages);
    const enKeys = Object.keys(enMessages);

    for (const ns of REQUIRED_NAMESPACES) {
      expect(idKeys, `id.json missing namespace '${ns}'`).toContain(ns);
      expect(enKeys, `en.json missing namespace '${ns}'`).toContain(ns);
    }
  });

  it('should preserve TASK-0601 bootstrap system namespace', () => {
    expect(idMessages).toHaveProperty('system');
    expect(enMessages).toHaveProperty('system');
  });

  it('should have 100% key parity between id.json and en.json', () => {
    const idPaths = getAllKeyPaths(idMessages as Record<string, unknown>);
    const enPaths = getAllKeyPaths(enMessages as Record<string, unknown>);

    expect(idPaths).toEqual(enPaths);
  });

  it('should not contain empty strings, whitespace-only values, or TODO placeholders', () => {
    const idPaths = getAllKeyPaths(idMessages as Record<string, unknown>);

    for (const path of idPaths) {
      const idVal = getValueByPath(idMessages as Record<string, unknown>, path);
      const enVal = getValueByPath(enMessages as Record<string, unknown>, path);

      expect(typeof idVal, `id value at ${path} is not string`).toBe('string');
      expect(typeof enVal, `en value at ${path} is not string`).toBe('string');

      const idStr = (idVal as string).trim();
      const enStr = (enVal as string).trim();

      expect(idStr.length, `id translation at ${path} is empty`).toBeGreaterThan(0);
      expect(enStr.length, `en translation at ${path} is empty`).toBeGreaterThan(0);

      expect(idStr, `id translation at ${path} contains TODO`).not.toMatch(/TODO|placeholder/i);
      expect(enStr, `en translation at ${path} contains TODO`).not.toMatch(/TODO|placeholder/i);
    }
  });

  it('should have identical interpolation placeholders between locales for every key', () => {
    const paths = getAllKeyPaths(idMessages as Record<string, unknown>);

    for (const path of paths) {
      const idVal = getValueByPath(idMessages as Record<string, unknown>, path) as string;
      const enVal = getValueByPath(enMessages as Record<string, unknown>, path) as string;

      const idPlaceholders = extractPlaceholders(idVal);
      const enPlaceholders = extractPlaceholders(enVal);

      expect(
        idPlaceholders,
        `Placeholder mismatch at key '${path}': id has ${JSON.stringify(idPlaceholders)}, en has ${JSON.stringify(enPlaceholders)}`
      ).toEqual(enPlaceholders);
    }
  });

  it('should NOT contain soil or water quality BAT (Battery) parameter keys per DEC-MON-086', () => {
    const idPaths = getAllKeyPaths(idMessages as Record<string, unknown>);
    const batKeys = idPaths.filter(
      (path) =>
        path.startsWith('soil.bat') || path.startsWith('water.battery') || path.endsWith('.bat')
    );

    expect(batKeys).toEqual([]);
  });

  it('should preserve technical abbreviations and units untranslated across namespaces', () => {
    expect(idMessages.soil.nitrogen).toContain('Nitrogen');
    expect(enMessages.soil.nitrogen).toContain('Nitrogen');

    expect(idMessages.soil.ph).toContain('pH');
    expect(enMessages.soil.ph).toContain('pH');

    expect(idMessages.soil.ec).toContain('EC');
    expect(enMessages.soil.ec).toContain('EC');

    expect(idMessages.water.tds).toContain('TDS');
    expect(enMessages.water.tds).toContain('TDS');

    expect(idMessages.soil.npkGroup).toContain('NPK');
    expect(enMessages.soil.npkGroup).toContain('NPK');

    expect(idMessages.faucet.phase1Volume).toContain('mL');
    expect(enMessages.faucet.phase1Volume).toContain('mL');
  });
});
