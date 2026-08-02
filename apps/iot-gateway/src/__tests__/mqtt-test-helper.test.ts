import { describe, it, expect } from 'vitest';
import { createIsolatedMqttTestContext } from '../testing/mqtt-test-helper';

describe('Isolated MQTT Test Helper', () => {
  it('creates isolated topic namespace and unique client IDs for tests', async () => {
    const ctx = createIsolatedMqttTestContext('gateway-unit');

    expect(ctx.clientId).toMatch(/^gateway-unit-[a-f0-9-]+$/);
    expect(ctx.topicPrefix).toMatch(/^agriculture\/test\/[a-f0-9-]+$/);
    expect(ctx.buildTopic('telemetry/soil')).toBe(`${ctx.topicPrefix}/telemetry/soil`);

    await expect(ctx.cleanup()).resolves.toBeUndefined();
  });
});
