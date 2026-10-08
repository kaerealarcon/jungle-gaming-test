import { defineConfig, devices } from '@playwright/test';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5175', timezoneId: 'UTC', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: process.env.PW_PREVIEW ? `${npm} run preview -- --host 127.0.0.1 --port 5175 --strictPort` : `${npm} run dev -- --mode e2e --port 5175 --strictPort`, url: 'http://127.0.0.1:5175', reuseExistingServer: !process.env.CI && !process.env.PW_PREVIEW, timeout: 30000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
