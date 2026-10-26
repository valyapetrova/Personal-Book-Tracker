import { defineConfig } from "@playwright/test";

import { E2E_DATABASE, E2E_PORT } from "./tests/e2e/support/paths";

/**
 * End-to-end tests: a real browser driving a production build of the app.
 * Run with `npm run test:e2e` (builds first). The tests need an internet
 * connection, because search and the reader use Project Gutenberg.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // The tests share one database, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  // Project Gutenberg is occasionally slow; give a failed test one more try.
  retries: process.env.CI ? 2 : 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    viewport: { width: 1280, height: 900 },
    // Use an installed browser instead of Playwright's own, e.g. PLAYWRIGHT_CHANNEL=msedge.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    env: { SHELFIE_DB_PATH: E2E_DATABASE },
    // Never reuse a server that might be using the real database.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
