import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'tests/test-results.json' }]],
  use: {
    baseURL: 'https://flipquik.com',
    headless: true,
    viewport: { width: 390, height: 844 },
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },
  projects: [
    // Auth setup — runs first, saves state
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    // No-auth tests (redirect checks)
    {
      name: 'no-auth',
      testMatch: /smoke\.test\.js/,
      grep: /AUTH.*without auth/,
      use: { browserName: 'chromium' },
    },
    // Authenticated tests — depend on setup
    {
      name: 'authenticated',
      testMatch: /smoke\.test\.js/,
      grepInvert: /AUTH/,
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        storageState: 'tests/.auth/state.json',
      },
    },
    // Auth flow tests (login/logout) — depend on setup
    {
      name: 'auth-flow',
      testMatch: /smoke\.test\.js/,
      grep: /AUTH.*(Login|Logout)/,
      dependencies: ['setup'],
      use: { browserName: 'chromium' },
    },
  ],
});
