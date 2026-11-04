// @ts-check
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// E2E tests (Playwright). Start the app yourself first: pnpm dev in client/ AND in server/.
//   cd client && pnpm test:e2e
//
// Test accounts come from client/.env.e2e (git-ignored in client/.gitignore): E2E_BUYER_EMAIL, E2E_BUYER_PASSWORD,
// E2E_SELLER_EMAIL, E2E_SELLER_PASSWORD, E2E_PRODUCT_ID. Never write them in a test file.
// (Not client/.env: that file is already committed to git, so .gitignore does not protect it.)
// process.loadEnvFile is built into Node (20.12+) - no extra library. It is NOT in the Week 10 slides.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env.e2e', import.meta.url)))
} catch {
  // no client/.env.e2e yet - the tests that need an account will say which variable is missing
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js', // only Playwright files - tests/format.test.js belongs to node:test (pnpm test:node)
  /* One test at a time: the order tests create real orders, and flow (5) needs flow (4) first */
  fullyParallel: false,
  workers: 1,
  retries: 0,
  /* the order flow takes about 20 s: login, page load, order, animation */
  timeout: 60000,
  /* pages can be slow on first load */
  expect: { timeout: 10000 },
  reporter: 'html',
  use: {
    /* The Vite dev server (pnpm dev in client/) */
    baseURL: 'http://localhost:5173',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Chromium only, so one run creates one order (not three) */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* No webServer block: start client and server yourself with pnpm dev */
})
