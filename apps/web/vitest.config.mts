import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // @ts-expect-error vite 8 oxc option
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@kebun-melon/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@kebun-melon/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './test/setup.ts')],
    pool: 'forks',
    execArgv: ['--max-old-space-size=4096'],
    maxWorkers: 1,
    isolate: true,
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/coverage/**',
        '**/e2e/**',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
});
