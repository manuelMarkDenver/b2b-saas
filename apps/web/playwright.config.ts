import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e configuration.
 * Requires the dev server to be running: `pnpm --filter web dev`
 * Or run with auto-start: `pnpm --filter web test:e2e`
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Login once before all tests, save state to e2e/.auth/user.json
  globalSetup: './e2e/global.setup.ts',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // Auth tests — test the login form itself, no saved state
    {
      name: 'auth',
      testMatch: '**/auth.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // All other tests — reuse saved auth state (no re-login per test)
    {
      name: 'desktop-chrome',
      testIgnore: '**/auth.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    {
      name: 'mobile-chrome',
      testIgnore: '**/auth.spec.ts',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],

  // Auto-start dev server when running tests locally
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
