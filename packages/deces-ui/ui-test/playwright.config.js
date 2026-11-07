// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// The suite runs inside the `ui-test` service (docker-compose-test.yml), on
// the same docker network as the local stack started by `make deploy-local`.
const host = process.env.TEST_HOST || 'localhost';
const port = process.env.PORT || '8083';

module.exports = defineConfig({
  testDir: './specs',
  globalSetup: require.resolve('./global-setup.js'),
  // All specs share one backend, one Elasticsearch index and the nginx rate
  // limits (bulk submissions are limited to 4 per minute): run them serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://${host}:${port}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
