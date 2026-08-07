import { defineConfig } from 'vitest/config';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

const dbIntegrationPatterns = [
  'test/integration.test.ts',
  'test/seed-owner.test.ts',
  'test/seed.test.ts',
  'test/**/*.integration.test.ts',
];

export default defineConfig({
  test: {
    globals: true,
    isolate: true,
    exclude: ['**/node_modules/**', '**/dist/**', ...dbIntegrationPatterns],
  },
});
