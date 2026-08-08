import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@kebun-melon/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@kebun-melon/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
