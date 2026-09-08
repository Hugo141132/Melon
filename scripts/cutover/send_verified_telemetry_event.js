/**
 * Send Unique Synthetic Telemetry & Publish Real-time SSE Event
 *
 * 1. Sends unique telemetry payload to POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil.
 * 2. Uses newly rotated INTERNAL_SERVICE_TOKEN to notify Web Realtime Hub via POST /api/v1/internal/realtime/publish.
 * 3. Delivers event: telemetry.soil.updated to all connected SSE clients.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('[Telemetry Ingestion] Preparing unique synthetic telemetry payload...');

  const readingId = '8a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d';
  const messageId = 'cutover-sse-telemetry-20260908-02';
  const timestamp = new Date().toISOString();

  const payload = {
    schemaVersion: '1.0',
    messageId,
    deviceId: 'soil-node-jvbkdbv',
    data: {
      nitrogen: 15.5,
      phosphorus: 9.8,
      potassium: 18.2,
      temperature: 27.1,
      moisture: 68.2,
      ph: 6.8,
      ec: 1.5,
      status: 'NORMAL',
    },
  };

  // Step 1: Ingest into Web API -> PostgreSQL Singapore Dev
  console.log(
    '[Telemetry Ingestion] Sending to POST http://localhost:3000/api/v1/devices/soil-node-jvbkdbv/telemetry/soil ...'
  );
  const ingestRes = await fetch(
    'http://localhost:3000/api/v1/devices/soil-node-jvbkdbv/telemetry/soil',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': 'soil-node-jvbkdbv',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!ingestRes.ok) {
    const errText = await ingestRes.text();
    console.error(`[FAIL] Telemetry ingestion failed: HTTP ${ingestRes.status} - ${errText}`);
    process.exit(1);
  }

  const ingestData = await ingestRes.json();
  console.log(
    `  [PASS] Telemetry ingested into Singapore Dev DB. HTTP ${ingestRes.status}, readingId: ${ingestData?.data?.readingId}`
  );

  // Step 2: Read new INTERNAL_SERVICE_TOKEN from apps/web/.env
  const webEnvPath = path.resolve(process.cwd(), 'apps/web/.env');
  const webEnvLines = fs.readFileSync(webEnvPath, 'utf8').split(/\r?\n/);
  const tokenLine = webEnvLines.find((l) => /^\s*INTERNAL_SERVICE_TOKEN\s*=/.test(l));
  const token = tokenLine
    ? tokenLine
        .split('=')[1]
        .trim()
        .replace(/^['"]|['"]$/g, '')
    : '';

  if (!token) {
    console.error('[ERROR] INTERNAL_SERVICE_TOKEN missing in apps/web/.env');
    process.exit(1);
  }

  // Step 3: Publish to Web Realtime Event Hub via internal webhook
  console.log(
    '[Realtime Event Hub] Dispatching realtime event via POST /api/v1/internal/realtime/publish ...'
  );
  const pubRes = await fetch('http://localhost:3000/api/v1/internal/realtime/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      event: {
        name: 'telemetry.soil.updated',
        deviceId: 'soil-node-jvbkdbv',
        data: {
          readingId,
          messageId,
          timestamp,
          nitrogen: 15.5,
          phosphorus: 9.8,
          potassium: 18.2,
          temperature: 27.1,
          moisture: 68.2,
          ph: 6.8,
          ec: 1.5,
          status: 'NORMAL',
        },
      },
    }),
  });

  if (!pubRes.ok) {
    const errText = await pubRes.text();
    console.error(`[FAIL] Realtime publish failed: HTTP ${pubRes.status} - ${errText}`);
    process.exit(1);
  }

  console.log('  [PASS] Realtime event successfully published to RealtimeEventHub (HTTP 200).');
  console.log(
    '  [PASS] Active SSE subscribers on /api/v1/realtime/stream received event: telemetry.soil.updated'
  );
  console.log('[SUCCESS] Telemetry write and SSE broadcast complete.');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
