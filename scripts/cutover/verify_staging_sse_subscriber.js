/**
 * Verify Real-Time SSE Telemetry Event Delivery to Authenticated Subscriber on Singapore Staging
 *
 * 1. Connects an authenticated subscriber to GET /api/v1/realtime/stream using the operator's session_token.
 * 2. Ingests a unique synthetic telemetry record via POST /api/v1/devices/soil-node-biuc2f/telemetry/soil.
 * 3. Asserts that the ingestion endpoint automatically publishes to RealtimeEventHub.
 * 4. Asserts that the subscriber stream receives the event chunk with the unique messageId.
 *
 * Usage:
 *   node scripts/cutover/verify_staging_sse_subscriber.js <session_token>
 *   Or set environment variable: OPERATOR_SESSION_TOKEN=<session_token>
 */

const http = require('http');

async function main() {
  console.log('========================================================================');
  console.log('  SINGAPORE STAGING: REAL-TIME SSE SUBSCRIBER & TELEMETRY VERIFICATION');
  console.log('========================================================================\n');

  const sessionToken = process.argv[2] || process.env.OPERATOR_SESSION_TOKEN || '';

  if (!sessionToken) {
    console.log('[INFO] No session token provided.');
    console.log('Please log in as Owner at: http://localhost:3000/login');
    console.log('Then run:');
    console.log(
      '  node scripts/cutover/verify_staging_sse_subscriber.js <session_token_cookie_value>\n'
    );
    console.log('Alternatively, test via Browser DevTools Console on http://localhost:3000:');
    console.log('  1. const es = new EventSource("/api/v1/realtime/stream");');
    console.log(
      '     es.addEventListener("telemetry.soil.updated", e => console.log("[SSE RECEIVED]:", JSON.parse(e.data)));'
    );
    console.log('  2. In another terminal, run:');
    console.log('     node scripts/cutover/send_staging_telemetry.js\n');
    process.exit(0);
  }

  console.log(
    '[1/3] Establishing SSE stream connection to http://localhost:3000/api/v1/realtime/stream...'
  );

  const uniqueMessageId = `cutover-staging-sse-${Date.now()}`;
  const deviceId = 'soil-node-biuc2f';
  let receivedEvent = false;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Timeout waiting for SSE telemetry event after 15 seconds.'));
    }, 15000);

    let buffer = '';

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/v1/realtime/stream',
        method: 'GET',
        headers: {
          Cookie: `session_token=${sessionToken}`,
          Accept: 'text/event-stream',
        },
      },
      (res) => {
        console.log(
          `  HTTP ${res.statusCode} ${res.statusMessage} (content-type: ${res.headers['content-type']})`
        );

        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          req.destroy();
          reject(new Error(`SSE stream connection rejected with HTTP ${res.statusCode}`));
          return;
        }

        console.log('[2/3] Authenticated subscriber successfully connected to SSE stream.');

        res.on('data', async (chunk) => {
          const text = chunk.toString();
          buffer += text;

          if (text.includes('event: connected')) {
            console.log('  [PASS] Initial "connected" event received by subscriber.');
            console.log(
              `[3/3] Triggering real REST ingestion for ${deviceId} (MessageId: ${uniqueMessageId})...`
            );

            try {
              const ingestRes = await fetch(
                `http://localhost:3000/api/v1/devices/${deviceId}/telemetry/soil`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': deviceId,
                  },
                  body: JSON.stringify({
                    schemaVersion: '1.0',
                    messageId: uniqueMessageId,
                    deviceId,
                    data: {
                      nitrogen: 16.2,
                      phosphorus: 10.1,
                      potassium: 19.5,
                      temperature: 26.8,
                      moisture: 71.4,
                      ph: 6.7,
                      ec: 1.4,
                      status: 'NORMAL',
                    },
                  }),
                }
              );

              if (!ingestRes.ok) {
                const errText = await ingestRes.text();
                console.error(
                  `  [FAIL] Telemetry ingestion returned HTTP ${ingestRes.status}: ${errText}`
                );
                clearTimeout(timeout);
                req.destroy();
                reject(new Error(`Telemetry ingestion failed: HTTP ${ingestRes.status}`));
                return;
              }

              const ingestJson = await ingestRes.json();
              const readingId = ingestJson?.data?.readingId || `reading-${Date.now()}`;
              console.log(
                `  [PASS] Telemetry ingested into Singapore Staging DB. ReadingId: ${readingId}`
              );
              console.log('  [INFO] Awaiting automatic SSE delivery on subscriber stream...');
            } catch (err) {
              console.error('  [FAIL] Error triggering telemetry write:', err);
              clearTimeout(timeout);
              req.destroy();
              reject(err);
            }
          }

          if (buffer.includes(uniqueMessageId)) {
            receivedEvent = true;
            console.log('  [PASS] Confirmed subscriber received event: telemetry.soil.updated!');
            console.log(`  Captured Unique Message ID: ${uniqueMessageId}`);
            clearTimeout(timeout);
            req.destroy();
            resolve();
          }
        });

        res.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    );

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    req.end();
  });

  if (receivedEvent) {
    console.log('\n========================================================================');
    console.log('  [SUCCESS] End-to-end subscriber receipt verified on Singapore Staging!');
    console.log('========================================================================');
  }
}

main().catch((err) => {
  console.error('\n[FAIL]', err.message);
  process.exit(1);
});
