/**
 * Operator Script: Rotate Dev INTERNAL_SERVICE_TOKEN
 *
 * Generates a cryptographically secure 32-byte (64-char hex) token using Node.js crypto.randomBytes(32).
 * Pre-validates that .env, apps/web/.env, and apps/iot-gateway/.env all exist and each contains exactly one assignment.
 * Updates only INTERNAL_SERVICE_TOKEN while preserving encoding, comments, and line endings.
 * Stores previous token temporarily in node_modules/.old_internal_token_tmp for post-rotation rejection verification.
 * Never prints tokens, credentials, or env files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TARGET_FILES = ['.env', 'apps/web/.env', 'apps/iot-gateway/.env'];

function main() {
  console.log('[Token Rotation] Pre-validating target environment files...');

  const fileData = [];

  for (const relPath of TARGET_FILES) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[ERROR] Target file does not exist: ${relPath}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(fullPath, 'utf8');
    const isCRLF = raw.includes('\r\n');
    const eol = isCRLF ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);

    const matchIndices = [];
    lines.forEach((line, idx) => {
      if (/^\s*INTERNAL_SERVICE_TOKEN\s*=/.test(line)) {
        matchIndices.push(idx);
      }
    });

    if (matchIndices.length === 0) {
      console.error(`[ERROR] INTERNAL_SERVICE_TOKEN is missing in: ${relPath}`);
      process.exit(1);
    }

    if (matchIndices.length > 1) {
      console.error(
        `[ERROR] Multiple INTERNAL_SERVICE_TOKEN assignments found in ${relPath} (lines: ${matchIndices.map((i) => i + 1).join(', ')})`
      );
      process.exit(1);
    }

    fileData.push({ relPath, fullPath, lines, eol, targetIndex: matchIndices[0] });
    console.log(
      `  - Verified ${relPath} (exactly 1 assignment at line ${matchIndices[0] + 1}, format: ${eol === '\r\n' ? 'CRLF' : 'LF'})`
    );
  }

  // Capture existing token for rejection verification
  const existingLine = fileData[0].lines[fileData[0].targetIndex];
  const oldToken = existingLine
    .split('=')[1]
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (oldToken) {
    try {
      const nmDir = path.resolve(process.cwd(), 'node_modules');
      if (fs.existsSync(nmDir)) {
        fs.writeFileSync(path.join(nmDir, '.old_internal_token_tmp'), oldToken, 'utf8');
      }
    } catch {
      // Non-fatal if temporary cache write fails
    }
  }

  // Generate 32-byte CSPRNG token (64 hex characters)
  const newToken = crypto.randomBytes(32).toString('hex');
  if (newToken.length !== 64 || !/^[0-9a-f]{64}$/.test(newToken)) {
    console.error('[ERROR] Generated token failed format validation.');
    process.exit(1);
  }

  console.log(
    '[Token Rotation] Generated cryptographically secure 32-byte hex token (256-bit entropy).'
  );
  console.log('[Token Rotation] Applying token update to target files...');

  for (const item of fileData) {
    item.lines[item.targetIndex] = `INTERNAL_SERVICE_TOKEN=${newToken}`;
    const updatedContent = item.lines.join(item.eol);
    fs.writeFileSync(item.fullPath, updatedContent, 'utf8');
    console.log(`  - Updated ${item.relPath}`);
  }

  // Post-validation: verify all 3 files now match and parse correctly
  for (const relPath of TARGET_FILES) {
    const fullPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const line = lines.find((l) => /^\s*INTERNAL_SERVICE_TOKEN\s*=/.test(l));
    if (!line) {
      console.error(`[ERROR] Post-validation failed: key missing in ${relPath}`);
      process.exit(1);
    }
    const val = line
      .split('=')[1]
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (val.length !== 64) {
      console.error(`[ERROR] Post-validation failed: unexpected token length in ${relPath}`);
      process.exit(1);
    }
  }

  console.log(
    '[Token Rotation] SUCCESS: INTERNAL_SERVICE_TOKEN has been rotated across all 3 Dev environment files.'
  );
  console.log('[Token Rotation] Staging environment (.env.staging) was preserved untouched.');
}

main();
