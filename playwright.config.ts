import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4321/closed-form/',
    // Optional: point at a locally installed Chromium (e.g. arm64 sandboxes without a Playwright download).
    ...(process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {}),
  },
  webServer: {
    command: 'pnpm preview --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321/closed-form/',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
