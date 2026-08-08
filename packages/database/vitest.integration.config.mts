import { defineConfig } from 'vitest/config';
import path from 'path';

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
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      'test/integration.test.ts',
      'test/seed-owner.test.ts',
      'test/seed.test.ts',
      'test/**/*.integration.test.ts',
    ],
  },
});
