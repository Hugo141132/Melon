import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.join(process.cwd(), 'apps', 'web', 'messages');

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

function checkTranslations() {
  const files = ['en.json', 'id.json'];
  const data: Record<string, FlattenedMessages> = {};
  const rawContents: Record<string, string> = {};
  let hasError = false;

  console.log('Checking translation completeness...');

  // 1. Read files and parse
  for (const file of files) {
    const filePath = path.join(MESSAGES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing file: ${file}`);
      hasError = true;
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    rawContents[file] = content;

    try {
      const json = JSON.parse(content);
      data[file] = flattenObject(json);
    } catch (e) {
      console.error(`❌ Invalid JSON in ${file}: ${(e as Error).message}`);
      hasError = true;
    }
  }

  if (hasError) process.exit(1);

  const enKeys = Object.keys(data['en.json']);
  const idKeys = Object.keys(data['id.json']);
  const allKeys = new Set([...enKeys, ...idKeys]);

  // 2. Check each key
  allKeys.forEach((key) => {
    const enVal = data['en.json'][key];
    const idVal = data['id.json'][key];

    // Missing/Extra Keys
    if (enVal === undefined) {
      console.error(`❌ Missing key in en.json: ${key}`);
      hasError = true;
      return;
    }
    if (idVal === undefined) {
      console.error(`❌ Missing key in id.json: ${key}`);
      hasError = true;
      return;
    }

    // Empty Translations
    if (enVal.trim() === '') {
      console.error(`❌ Empty translation in en.json for key: ${key}`);
      hasError = true;
    }
    if (idVal.trim() === '') {
      console.error(`❌ Empty translation in id.json for key: ${key}`);
      hasError = true;
    }

    // Raw Untranslated Keys
    if (enVal === key) {
      console.error(`❌ Raw untranslated key in en.json: ${key}`);
      hasError = true;
    }
    if (idVal === key) {
      console.error(`❌ Raw untranslated key in id.json: ${key}`);
      hasError = true;
    }

    // Placeholder Mismatches
    const enPlaceholders = extractPlaceholders(enVal);
    const idPlaceholders = extractPlaceholders(idVal);
    if (JSON.stringify(enPlaceholders) !== JSON.stringify(idPlaceholders)) {
      console.error(
        `❌ Placeholder mismatch for ${key}: EN=[${enPlaceholders.join(',')}] vs ID=[${idPlaceholders.join(',')}]`
      );
      hasError = true;
    }
  });

  // 3. Duplicate Keys Check
  for (const file of files) {
    const duplicates = findDuplicateKeys(rawContents[file]);
    if (duplicates.length > 0) {
      duplicates.forEach((dup) => {
        console.error(`❌ Duplicate key found in ${file}: ${dup}`);
      });
      hasError = true;
    }
  }

  if (hasError) {
    console.error('\n❌ Translation completeness check failed. See errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ Translation completeness check passed successfully.');
    process.exit(0);
  }
}

checkTranslations();
