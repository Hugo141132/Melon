/**
 * Generates an isolated test entity prefix with timestamp and random UUID snippet
 * to prevent test data collisions and non-destructive shared-database testing.
 */
export function generateTestIsolationPrefix(tag: string = 'test'): string {
  const nonce = Math.random().toString(36).substring(2, 8);
  return `${tag}_${Date.now()}_${nonce}`;
}
