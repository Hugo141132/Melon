import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

const dbIntegrationPatterns = [
  '**/*.integration.test.ts',
  '**/test/integration.test.ts',
  '**/test/seed-owner.test.ts',
  '**/test/seed.test.ts',
  'test/integration.test.ts',
  'test/seed-owner.test.ts',
  'test/seed.test.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web'),
    },
  },
  projects: ['apps/*', 'packages/*'],
  test: {
    globals: true,
    isolate: true,
    environment: 'jsdom',
    setupFiles: ['./apps/web/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/e2e/**',
      ...(hasTestDb ? [] : dbIntegrationPatterns),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
    },
  },
});
