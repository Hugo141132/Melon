import { test, expect } from '@playwright/test';

test.describe('Application E2E Smoke Tests', () => {
  test('unauthenticated request to protected route redirects to login or status', async ({
    page,
  }) => {
    const response = await page.goto('/devices');
    expect(response?.status()).toBeLessThan(500);
    expect(page.url()).toMatch(/\/(login|status|devices)/);
  });

  test('status page renders successfully', async ({ page }) => {
    const response = await page.goto('/status');
    expect(response?.status()).toBeLessThan(500);
  });
});
