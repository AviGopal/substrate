import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for metabob E2E tests
 *
 * Tests run against deployed services in the Kubernetes cluster.
 * Each milestone has its own test file(s) that can be run independently.
 *
 * Service URLs (per Istio gateway config):
 * - activity.metabob.local → metabob-activity-api (MiniBob auth, templates, traces)
 * - api.metabob.local → metabob-analysis-api (user auth, analysis routes)
 * - app.metabob.local → metabob-cloud-dashboard
 *
 * Required /etc/hosts entries:
 * 127.0.0.1 activity.metabob.local api.metabob.local app.metabob.local surql.metabob.local
 */
export default defineConfig({
  testDir: './',
  timeout: 30000,
  expect: { timeout: 5000 },

  // Run sequentially to maintain data consistency across tests
  fullyParallel: false,
  workers: 1,

  // Retry configuration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Reporting
  reporter: [
    ['html', { outputFolder: '../test-results/html' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['list']
  ],

  // Global setup/teardown for test fixtures
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),

  use: {
    // Dashboard base URL (app.metabob.local per Istio gateway config)
    baseURL: process.env.DASHBOARD_URL || 'http://app.metabob.local',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  projects: [
    // Main test project
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Ensure services are available before running tests
  webServer: {
    command: 'echo "Using deployed services"',
    // Use activity API health check (activity.metabob.local per Istio gateway)
    url: process.env.ACTIVITY_API_URL ? `${process.env.ACTIVITY_API_URL}/health` : 'http://activity.metabob.local/health',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
