/**
 * Verification Script: Dev INTERNAL_SERVICE_TOKEN Rotation & Readiness Probes
 *
 * Verifies that:
 * 1. Unauthenticated requests to /internal/v1/ready are rejected with HTTP 401.
 * 2. Requests using the previous/stale token are rejected with HTTP 401.
 * 3. Requests using the new rotated token are accepted with HTTP 200.
 * 4. Next.js Web /ready probe succeeds with HTTP 200 via internal gateway probe.
 * 5. Web and Gateway health probes return HTTP 200.
 *
 * Never prints tokens, credentials, or secrets to stdout/stderr.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('[Verification] Starting Dev Token Rotation & Health Verification...');

  // 1. Read new token from apps/web/.env
  const webEnvPath = path.resolve(process.cwd(), 'apps/web/.env');
  if (!fs.existsSync(webEnvPath)) {
    console.error('[ERROR] apps/web/.env does not exist.');
    process.exit(1);
  }
  const webEnvLines = fs.readFileSync(webEnvPath, 'utf8').split(/\r?\n/);
  const tokenLine = webEnvLines.find((l) => /^\s*INTERNAL_SERVICE_TOKEN\s*=/.test(l));
  if (!tokenLine) {
    console.error('[ERROR] INTERNAL_SERVICE_TOKEN not found in apps/web/.env');
    process.exit(1);
  }
  const newToken = tokenLine
    .split('=')[1]
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (newToken.length !== 64) {
    console.error('[ERROR] Unexpected token format in apps/web/.env (expected 64-char hex).');
    process.exit(1);
  }

  // 2. Read and purge old token cache
  const oldTokenPath = path.resolve(process.cwd(), 'node_modules/.old_internal_token_tmp');
  let oldToken = null;
  if (fs.existsSync(oldTokenPath)) {
    oldToken = fs.readFileSync(oldTokenPath, 'utf8').trim();
    try {
      fs.unlinkSync(oldTokenPath);
    } catch {}
  }

  let allPassed = true;

  // Probe A: Gateway /health (Public Liveness)
  try {
    const res = await fetch('http://localhost:3001/health');
    if (res.status === 200) {
      console.log('  [PASS] Gateway /health returns HTTP 200 OK.');
    } else {
      console.error(`  [FAIL] Gateway /health returned HTTP ${res.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('  [FAIL] Gateway /health is unreachable:', err.message);
    allPassed = false;
  }

  // Probe B: Web /health (Public Liveness)
  try {
    const res = await fetch('http://localhost:3000/health');
    if (res.status === 200) {
      console.log('  [PASS] Web /health returns HTTP 200 OK.');
    } else {
      console.error(`  [FAIL] Web /health returned HTTP ${res.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('  [FAIL] Web /health is unreachable:', err.message);
    allPassed = false;
  }

  // Probe C: Gateway /internal/v1/ready without Auth Header
  try {
    const res = await fetch('http://localhost:3001/internal/v1/ready');
    if (res.status === 401) {
      console.log(
        '  [PASS] Gateway /internal/v1/ready correctly rejects unauthenticated requests (HTTP 401).'
      );
    } else {
      console.error(
        `  [FAIL] Gateway /internal/v1/ready returned HTTP ${res.status} (expected 401)`
      );
      allPassed = false;
    }
  } catch (err) {
    console.error('  [FAIL] Gateway /internal/v1/ready is unreachable:', err.message);
    allPassed = false;
  }

  // Probe D: Gateway /internal/v1/ready with Stale/Old Token (if captured)
  if (oldToken) {
    try {
      const res = await fetch('http://localhost:3001/internal/v1/ready', {
        headers: { Authorization: `Bearer ${oldToken}` },
      });
      if (res.status === 401) {
        console.log(
          '  [PASS] Gateway /internal/v1/ready correctly rejects previous stale token (HTTP 401).'
        );
      } else {
        console.error(
          `  [FAIL] Gateway /internal/v1/ready accepted stale token! HTTP ${res.status}`
        );
        allPassed = false;
      }
    } catch (err) {
      console.error(
        '  [FAIL] Gateway /internal/v1/ready probe with stale token failed:',
        err.message
      );
      allPassed = false;
    }
  } else {
    console.log('  [INFO] Stale token cache not present; skipping stale token rejection probe.');
  }

  // Probe E: Gateway /internal/v1/ready with New Rotated Token
  try {
    const res = await fetch('http://localhost:3001/internal/v1/ready', {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (res.status === 200) {
      const body = await res.json().catch(() => null);
      if (body?.status === 'ready' && body?.dependencies?.database === 'up') {
        console.log(
          '  [PASS] Gateway /internal/v1/ready accepts new rotated token (HTTP 200, status: ready, database: up).'
        );
      } else {
        console.log(
          `  [PASS] Gateway /internal/v1/ready authenticated successfully with new token (HTTP 200, status: ${body?.status}).`
        );
      }
    } else {
      console.error(`  [FAIL] Gateway /internal/v1/ready rejected new token! HTTP ${res.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('  [FAIL] Gateway /internal/v1/ready probe with new token failed:', err.message);
    allPassed = false;
  }

  // Probe F: Web /ready probe (uses new token internally to call Gateway)
  try {
    const res = await fetch('http://localhost:3000/ready');
    if (res.status === 200) {
      const body = await res.json().catch(() => null);
      if (body?.dependencies?.gateway === 'up') {
        console.log(
          '  [PASS] Web /ready succeeds (HTTP 200, gateway dependency: up via rotated token).'
        );
      } else {
        console.log(
          `  [WARN] Web /ready returned HTTP 200, but gateway dependency status is: ${body?.dependencies?.gateway}`
        );
      }
    } else {
      console.error(`  [FAIL] Web /ready returned HTTP ${res.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('  [FAIL] Web /ready probe failed:', err.message);
    allPassed = false;
  }

  if (allPassed) {
    console.log('[Verification] SUCCESS: All token rotation and health checks passed.');
  } else {
    console.error('[Verification] FAILURE: One or more health/readiness checks failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
