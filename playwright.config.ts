import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { ensureTestDatabase } from './e2e/test-environment';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const testPort = process.env.PLAYWRIGHT_TEST_PORT || '3005';
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${testPort}`;

const validatedDbUrl = ensureTestDatabase();

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  globalTeardown: require.resolve('./e2e/global-teardown'),
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      PORT: testPort,
      ENABLE_FAUCET_CONTROL: 'true',
      ...(validatedDbUrl ? { DATABASE_URL: validatedDbUrl } : {}),
    },
  },
});
