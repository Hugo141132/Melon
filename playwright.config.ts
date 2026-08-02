import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: process.env.CI
    ? [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
          },
        },
      ]
    : [
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
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
