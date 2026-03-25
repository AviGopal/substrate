import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Internal Dashboard
 *
 * Tests verify that MiniBob can control the UI via WebSocket.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the server before running tests
  webServer: {
    command: 'bun run src/index.ts',
    url: 'http://localhost:3001/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
