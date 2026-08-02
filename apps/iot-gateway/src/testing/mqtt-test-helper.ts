import { randomUUID } from 'crypto';

export interface IsolatedMqttTestContext {
  testId: string;
  clientId: string;
  topicPrefix: string;
  buildTopic: (subpath: string) => string;
  cleanup: () => Promise<void>;
}

export function createIsolatedMqttTestContext(
  prefix: string = 'test-run'
): IsolatedMqttTestContext {
  const testId = randomUUID();
  const clientId = `${prefix}-${testId.substring(0, 8)}`;
  const topicPrefix = `agriculture/test/${testId.substring(0, 8)}`;

  const activeSubscriptions: string[] = [];

  return {
    testId,
    clientId,
    topicPrefix,
    buildTopic: (subpath: string) => `${topicPrefix}/${subpath.replace(/^\//, '')}`,
    cleanup: async () => {
      activeSubscriptions.length = 0;
    },
  };
}
