import path from "node:path";

/** The browser tests run their own server on this port… */
export const E2E_PORT = 3210;

/** …with their own database, so the real library (data/shelfie.db) is never touched. */
export const E2E_DATABASE = path.resolve("test-results", "e2e-database", "shelfie.db");
