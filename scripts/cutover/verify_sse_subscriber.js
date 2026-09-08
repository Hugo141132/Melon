/**
 * Verify Real-Time SSE Telemetry Event Delivery to Authenticated Subscriber
 *
 * Connects an authenticated subscriber to GET /api/v1/realtime/stream,
 * dispatches a unique telemetry event via POST /api/v1/internal/realtime/publish,
 * and asserts that the subscriber stream actually receives the event chunk.
 *
 * Usage:
 *   node scripts/cutover/verify_sse_subscriber.js [session_token]
 *   Or set environment variable: OPERATOR_SESSION_TOKEN=<session_token>
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('===========================================================');
  console.log(' Real-Time SSE Authenticated Subscriber Verification');
  console.log('===========================================================\n');

  const sessionToken = process.argv[2] || process.env.OPERATOR_SESSION_TOKEN || '';

  if (!sessionToken) {
    console.log('[INFO] No session token provided.');
    console.log('To verify subscriber-side receipt with an existing authorized session:');
    console.log('');
    console.log('  Option 1 (Automated Script):');
    console.log('    node scripts/cutover/verify_sse_subscriber.js <session_token_cookie_value>');
    console.log('');
    console.log('  Option 2 (Browser DevTools in logged-in Owner tab):');
    console.log('    1. In your browser tab (http://localhost:3000), open DevTools Console.');
    console.log('    2. Run:');
    console.log("       const es = new EventSource('/api/v1/realtime/stream');");
    console.log(
      "       es.addEventListener('telemetry.soil.updated', e => console.log('[SSE EVENT RECEIVED]:', JSON.parse(e.data)));"
    );
    console.log('    3. Run: node scripts/cutover/send_verified_telemetry_event.js');
    console.log('    4. Observe [SSE EVENT RECEIVED] logged in your browser console.\n');
    process.exit(0);
  }

  // 1. Read INTERNAL_SERVICE_TOKEN from apps/web/.env
  const webEnvPath = path.resolve(process.cwd(), 'apps/web/.env');
  if (!fs.existsSync(webEnvPath)) {
    console.error(`[FAIL] Environment file not found: ${webEnvPath}`);
    process.exit(1);
  }

  const envLines = fs.readFileSync(webEnvPath, 'utf8').split(/\r?\n/);
  const tokenLine = envLines.find((l) => /^\s*INTERNAL_SERVICE_TOKEN\s*=/.test(l));
  const internalToken = tokenLine
    ? tokenLine
        .split('=')[1]
        .trim()
        .replace(/^['"]|['"]$/g, '')
    : '';

  if (!internalToken) {
    console.error('[FAIL] INTERNAL_SERVICE_TOKEN missing in apps/web/.env');
    process.exit(1);
  }

  console.log('[1/4] Establishing SSE stream connection to localhost:3000...');

  const uniqueMessageId = `cutover-sse-subscriber-check-${Date.now()}`;
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

        console.log('[2/4] Authenticated subscriber connected to SSE stream.');

        res.on('data', async (chunk) => {
          const text = chunk.toString();
          buffer += text;

          if (text.includes('event: connected')) {
            console.log('  [PASS] Initial "connected" event received by subscriber.');
            console.log('[3/4] Dispatching test telemetry event via internal publish webhook...');

            // Trigger publish webhook
            try {
              const pubRes = await fetch('http://localhost:3000/api/v1/internal/realtime/publish', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${internalToken}`,
                },
                body: JSON.stringify({
                  event: {
                    name: 'telemetry.soil.updated',
                    deviceId: 'soil-node-jvbkdbv',
                    data: {
                      messageId: uniqueMessageId,
                      readingId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
                      timestamp: new Date().toISOString(),
                      nitrogen: 15.5,
                      moisture: 68.2,
                      status: 'NORMAL',
                    },
                  },
                }),
              });

              if (!pubRes.ok) {
                console.error(`  [FAIL] Internal publish returned HTTP ${pubRes.status}`);
              } else {
                console.log(
                  '  [PASS] Internal publish returned HTTP 200 (dispatched to RealtimeEventHub).'
                );
                console.log('[4/4] Awaiting event delivery on subscriber stream...');
              }
            } catch (err) {
              console.error('  [FAIL] Failed to trigger internal publish:', err);
            }
          }

          if (buffer.includes(uniqueMessageId)) {
            receivedEvent = true;
            console.log('  [PASS] Confirmed subscriber received event: telemetry.soil.updated!');
            console.log(`  Captured Message ID: ${uniqueMessageId}`);
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
    console.log('\n[SUCCESS] End-to-end subscriber receipt verified on Singapore Dev.');
  }
}

main().catch((err) => {
  console.error('\n[FAIL]', err.message);
  process.exit(1);
});
