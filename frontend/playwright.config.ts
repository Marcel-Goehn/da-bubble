import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// The stack reads the root .env too, so overridden Keycloak admin credentials reach the tests.
try {
  process.loadEnvFile(resolve(__dirname, '../.env'));
} catch {
  // No .env: every key has a dev default.
}

/**
 * E2E journeys and the Lighthouse gate against the compose stack and the real themed Keycloak.
 * `npm run e2e` and `npm run lighthouse` start the stack first; see README.md.
 */
export default defineConfig({
  testDir: 'e2e',
  // The journeys share one stack and Keycloak's per-browser login session; one at a time is plenty.
  workers: 1,
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4200',
    // German is the default language of the app, Keycloak and its emails.
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: 'lighthouse/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'lighthouse',
      testMatch: 'lighthouse/**/*.spec.ts',
      timeout: 300_000,
    },
  ],
  webServer: {
    // The production build, as users get it; ng serve still proxies /api and /ws to the backend.
    command: 'npx ng serve --configuration production',
    url: 'http://localhost:4200',
    // A running `ng serve` is usually the development build, so never measure that one by accident.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
