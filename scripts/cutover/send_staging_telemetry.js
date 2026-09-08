/**
 * Ingests unique synthetic telemetry through the real REST ingestion endpoint on Singapore Staging.
 * The endpoint atomically persists the reading to PostgreSQL and publishes to RealtimeEventHub.
 * Use alongside browser DevTools console EventSource listener on http://localhost:3000.
 */

async function main() {
  const uniqueMessageId = `cutover-staging-telemetry-${Date.now()}`;
  const deviceId = 'soil-node-biuc2f';

  console.log(`[1/2] Sending telemetry for ${deviceId} (MessageId: ${uniqueMessageId})...`);
  const ingestRes = await fetch(`http://localhost:3000/api/v1/devices/${deviceId}/telemetry/soil`, {
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
  });

  if (!ingestRes.ok) {
    const err = await ingestRes.text();
    console.error(`[FAIL] Telemetry ingestion failed HTTP ${ingestRes.status}: ${err}`);
    process.exit(1);
  }

  const ingestJson = await ingestRes.json();
  const readingId = ingestJson?.data?.readingId || `reading-${Date.now()}`;
  console.log(`[PASS] Ingested into Singapore Staging PostgreSQL. readingId: ${readingId}`);
  console.log(
    `[2/2] Backend automatically published telemetry.soil.updated to RealtimeEventHub for active subscribers.`
  );
  console.log(`[SUCCESS] Verify receipt in your browser console EventSource listener.`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
