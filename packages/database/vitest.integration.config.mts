import { defineConfig } from 'vitest/config';

export default defineConfig({
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
