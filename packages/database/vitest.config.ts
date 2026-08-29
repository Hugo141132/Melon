import { defineConfig } from 'vitest/config';
import path from 'path';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

const dbIntegrationPatterns = [
  '**/*.integration.test.ts',
  'test/*.integration.test.ts',
  'test/**/*.integration.test.ts',
  'test/integration.test.ts',
  'test/seed-owner.test.ts',
  'test/seed.test.ts',
];

export default defineConfig({
  resolve: {
    alias: {
      '@kebun-melon/contracts': path.resolve(__dirname, '../contracts/src/index.ts'),
      '@kebun-melon/database': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    globals: true,
    isolate: true,
    exclude: ['**/node_modules/**', '**/dist/**', ...dbIntegrationPatterns],
  },
});
