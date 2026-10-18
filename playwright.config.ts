import { defineConfig } from '@playwright/test';

const TEST_PORT = 3099;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  projects: [
    {
      name: 'api',
      testMatch: /^(?!.*[\/\\]ui[\/\\]).*\.spec\.ts$/,
    },
    {
      name: 'ui',
      testDir: './tests/e2e/ui',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
      },
    },
  ],
  webServer: {
    command: `npx next dev --port ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
