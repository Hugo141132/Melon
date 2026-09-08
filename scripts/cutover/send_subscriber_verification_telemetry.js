/**
 * Send Single Uniquely Identified Telemetry Payload for Subscriber SSE Verification
 *
 * Ingests a unique telemetry payload into POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil
 * and publishes the event to Realtime Event Hub via POST /api/v1/internal/realtime/publish.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const readingId = crypto.randomUUID();
  const messageId = `cutover-sse-subscriber-20260908-03`;
  const timestamp = new Date().toISOString();

  const payload = {
    schemaVersion: '1.0',
    messageId,
    deviceId: 'soil-node-jvbkdbv',
    data: {
      nitrogen: 16.0,
      phosphorus: 10.2,
      potassium: 19.1,
      temperature: 26.8,
      moisture: 69.5,
      ph: 6.7,
      ec: 1.6,
      status: 'NORMAL',
    },
  };

  console.log('===========================================================');
  console.log(' Ingesting Uniquely Identified Telemetry Payload');
  console.log('===========================================================');
  console.log(`Message ID: ${messageId}`);
  console.log(`Reading ID: ${readingId}`);
  console.log(`Timestamp:  ${timestamp}\n`);

  // Step 1: Real Ingestion Endpoint
  console.log(
    '[1/2] Sending to real REST endpoint: POST http://localhost:3000/api/v1/devices/soil-node-jvbkdbv/telemetry/soil ...'
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
    console.error(`[FAIL] Ingestion failed: HTTP ${ingestRes.status} - ${errText}`);
    process.exit(1);
  }

  const ingestData = await ingestRes.json();
  const persistedReadingId = ingestData?.data?.readingId || readingId;
  console.log(
    `  [PASS] Ingested into Singapore Dev DB. HTTP ${ingestRes.status}, readingId: ${persistedReadingId}`
  );

  // Step 2: Read INTERNAL_SERVICE_TOKEN from apps/web/.env
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
    console.error('[FAIL] INTERNAL_SERVICE_TOKEN missing in apps/web/.env');
    process.exit(1);
  }

  // Step 3: Publish to Web Realtime Event Hub via internal webhook
  console.log(
    '[2/2] Dispatching to Web Realtime Event Hub via POST /api/v1/internal/realtime/publish ...'
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
          readingId: persistedReadingId,
          messageId,
          timestamp,
          nitrogen: 16.0,
          phosphorus: 10.2,
          potassium: 19.1,
          temperature: 26.8,
          moisture: 69.5,
          ph: 6.7,
          ec: 1.6,
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

  console.log('  [PASS] Realtime event published to RealtimeEventHub (HTTP 200).');
  console.log(
    `\n[SUCCESS] Telemetry dispatched. Awaiting subscriber-side verification of Message ID: ${messageId}`
  );
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
