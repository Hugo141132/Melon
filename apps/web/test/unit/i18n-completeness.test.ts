import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ACTUAL_MESSAGES_DIR = path.join(__dirname, '..', '..', 'messages');

interface FlattenedMessages {
  [key: string]: string;
}

function flattenObject(obj: any, prefix = ''): FlattenedMessages {
  return Object.keys(obj).reduce((acc: FlattenedMessages, k: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)).sort() : [];
}

function findDuplicateKeys(content: string): string[] {
  const duplicates: string[] = [];
  const stack: { keys: Set<string>; path: string }[] = [];

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for closing braces
    if (line.startsWith('}') || line.startsWith('},')) {
      stack.pop();
    }

    // Check for object opening with key: "namespace": {
    const objMatch = line.match(/^"([^"]+)"\s*:\s*\{/);
    if (objMatch) {
      const key = objMatch[1];
      const current = stack[stack.length - 1];
      if (current) {
        if (current.keys.has(key)) {
          duplicates.push(current.path ? `${current.path}.${key}` : key);
        } else {
          current.keys.add(key);
        }
      }
      stack.push({
        keys: new Set<string>(),
        path: current && current.path ? `${current.path}.${key}` : key,
      });
      continue;
    }

    // Check for top-level or standard object opening: {
    if (line === '{') {
      stack.push({ keys: new Set<string>(), path: '' });
      continue;
    }

    // Check for key-value pair: "key": ...
    const keyMatch = line.match(/^"([^"]+)"\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      const current = stack[stack.length - 1];
      if (current) {
        if (current.keys.has(key)) {
          duplicates.push(current.path ? `${current.path}.${key}` : key);
        } else {
          current.keys.add(key);
        }
      }
    }
  }

  return duplicates;
}

describe('Translation Completeness and Parity (TASK-0605)', () => {
  let enRaw: string;
  let idRaw: string;
  let enJson: any;
  let idJson: any;
  let enFlat: FlattenedMessages;
  let idFlat: FlattenedMessages;
  let enKeys: string[];
  let idKeys: string[];

  it('should load translation files successfully', () => {
    expect(fs.existsSync(path.join(ACTUAL_MESSAGES_DIR, 'en.json'))).toBe(true);
    expect(fs.existsSync(path.join(ACTUAL_MESSAGES_DIR, 'id.json'))).toBe(true);

    enRaw = fs.readFileSync(path.join(ACTUAL_MESSAGES_DIR, 'en.json'), 'utf-8');
    idRaw = fs.readFileSync(path.join(ACTUAL_MESSAGES_DIR, 'id.json'), 'utf-8');

    enJson = JSON.parse(enRaw);
    idJson = JSON.parse(idRaw);

    enFlat = flattenObject(enJson);
    idFlat = flattenObject(idJson);

    enKeys = Object.keys(enFlat);
    idKeys = Object.keys(idFlat);
  });

  it('should not have duplicate keys in en.json', () => {
    const duplicates = findDuplicateKeys(enRaw);
    expect(duplicates).toEqual([]);
  });

  it('should not have duplicate keys in id.json', () => {
    const duplicates = findDuplicateKeys(idRaw);
    expect(duplicates).toEqual([]);
  });

  it('should have 100% key parity between en and id', () => {
    const missingInId = enKeys.filter((k) => !idKeys.includes(k));
    const missingInEn = idKeys.filter((k) => !enKeys.includes(k));

    expect(missingInId).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('should not have any empty translations', () => {
    const emptyEn = enKeys.filter((k) => enFlat[k].trim() === '');
    const emptyId = idKeys.filter((k) => idFlat[k].trim() === '');

    expect(emptyEn).toEqual([]);
    expect(emptyId).toEqual([]);
  });

  it('should not have raw untranslated keys', () => {
    // Value matches exactly its full dot-path key
    const rawEn = enKeys.filter((k) => enFlat[k] === k);
    const rawId = idKeys.filter((k) => idFlat[k] === k);

    expect(rawEn).toEqual([]);
    expect(rawId).toEqual([]);
  });

  it('should have identical ICU placeholders for every key', () => {
    const mismatchKeys: string[] = [];

    enKeys.forEach((key) => {
      if (!idKeys.includes(key)) return;

      const enPlaceholders = extractPlaceholders(enFlat[key]);
      const idPlaceholders = extractPlaceholders(idFlat[key]);

      if (JSON.stringify(enPlaceholders) !== JSON.stringify(idPlaceholders)) {
        mismatchKeys.push(key);
      }
    });

    expect(mismatchKeys).toEqual([]);
  });
});
