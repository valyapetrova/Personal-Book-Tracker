import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/**
 * Unit and integration tests for the app's logic (no browser needed).
 * UI flows are covered by the Playwright tests in tests/e2e.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.join(root, "src")}/` },
      // "server-only" refuses to load outside Next.js's server; in tests it is a no-op.
      { find: "server-only", replacement: path.join(root, "tests/unit/support/empty-module.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Every test file gets its own temporary database.
    setupFiles: ["tests/unit/support/temp-database.ts"],
  },
});
