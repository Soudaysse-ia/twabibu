import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys (QA-01, docs/01-produit/personas-et-parcours.md) against running apps and seeded demo data:
 *   pnpm db:seed, then start the API (:4000), the site (:3100) and the back-office (:3200), then
 *   pnpm --filter @twabibu/web e2e
 * Journeys share the demo agendas, so they run one after another.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    locale: 'fr-FR',
    timezoneId: 'Indian/Comoro',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // Phones: the journeys a patient makes on a phone (tagged @mobile).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
