import path from "node:path";

/**
 * The browser tests run their own server on this port… Override it with E2E_PORT
 * if Windows has reserved the port (see `netsh interface ipv4 show excludedportrange protocol=tcp`).
 */
export const E2E_PORT = Number(process.env.E2E_PORT) || 4173;

/** …with their own database, so the real library (data/shelfie.db) is never touched. */
export const E2E_DATABASE = path.resolve("test-results", "e2e-database", "shelfie.db");
