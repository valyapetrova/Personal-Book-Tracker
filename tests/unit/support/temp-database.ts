import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

/**
 * Points the app at a fresh SQLite file for each test file, so tests never
 * touch the real library in data/shelfie.db. The database is created (and
 * migrated) the first time a test uses it, and deleted afterwards.
 */
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shelfie-test-"));
process.env.SHELFIE_DB_PATH = path.join(directory, "shelfie.db");

afterAll(() => {
  globalThis.__shelfieDb?.close();
  globalThis.__shelfieDb = undefined;
  fs.rmSync(directory, { recursive: true, force: true });
});
