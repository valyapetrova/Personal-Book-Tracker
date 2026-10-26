import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * SQLite connection for Shelfie, using Node's built-in `node:sqlite` driver
 * (no native build step required).
 *
 * Data-safety measures:
 * - WAL journal + `synchronous = FULL`: every committed write survives a crash
 *   or power loss, and readers never see a half-written transaction.
 * - `STRICT` tables and CHECK constraints: the database itself rejects values
 *   of the wrong type or an unknown shelf, even if application code has a bug.
 * - Versioned migrations run inside a single transaction, so the schema is
 *   never left half-upgraded.
 * - The connection is closed on shutdown so the WAL is checkpointed cleanly.
 */

const DB_PATH = process.env.SHELFIE_DB_PATH ?? path.join(process.cwd(), "data", "shelfie.db");

/** SQL expression for the current UTC time as an ISO 8601 string. */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Schema migrations, applied in order. `PRAGMA user_version` records how many
 * have run. Never edit a migration that has shipped; append a new one instead.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE books (
    id          INTEGER PRIMARY KEY CHECK (id > 0), -- Project Gutenberg ebook number
    title       TEXT    NOT NULL CHECK (length(title) > 0),
    author      TEXT    NOT NULL,
    summary     TEXT,
    cover_url   TEXT,
    text_url    TEXT,
    shelf       TEXT    NOT NULL CHECK (shelf IN ('want-to-read', 'reading', 'finished')),
    last_page   INTEGER NOT NULL DEFAULT 0 CHECK (last_page >= 0),
    page_count  INTEGER CHECK (page_count IS NULL OR page_count > 0),
    added_at    TEXT    NOT NULL DEFAULT (${SQL_NOW}),
    updated_at  TEXT    NOT NULL DEFAULT (${SQL_NOW})
  ) STRICT;

  CREATE INDEX books_shelf_updated_idx ON books (shelf, updated_at DESC);

  -- Downloaded book texts, so each book is fetched from Project Gutenberg only once.
  CREATE TABLE book_texts (
    book_id     INTEGER PRIMARY KEY CHECK (book_id > 0),
    content     TEXT    NOT NULL,
    fetched_at  TEXT    NOT NULL DEFAULT (${SQL_NOW})
  ) STRICT;
  `,
  `
  -- Book details from Project Gutenberg's catalog (summary, cover, text file),
  -- so each book's record is fetched only once.
  CREATE TABLE book_details (
    id          INTEGER PRIMARY KEY CHECK (id > 0),
    title       TEXT    NOT NULL CHECK (length(title) > 0),
    author      TEXT    NOT NULL,
    summary     TEXT,
    cover_url   TEXT,
    text_url    TEXT,
    fetched_at  TEXT    NOT NULL DEFAULT (${SQL_NOW})
  ) STRICT;
  `,
  `
  -- Adds the "Did not finish" shelf. SQLite cannot change a CHECK constraint
  -- in place, so the table is rebuilt; this runs inside the migration
  -- transaction, so no data can be lost half-way.
  CREATE TABLE books_new (
    id          INTEGER PRIMARY KEY CHECK (id > 0),
    title       TEXT    NOT NULL CHECK (length(title) > 0),
    author      TEXT    NOT NULL,
    summary     TEXT,
    cover_url   TEXT,
    text_url    TEXT,
    shelf       TEXT    NOT NULL CHECK (shelf IN ('want-to-read', 'reading', 'finished', 'dnf')),
    last_page   INTEGER NOT NULL DEFAULT 0 CHECK (last_page >= 0),
    page_count  INTEGER CHECK (page_count IS NULL OR page_count > 0),
    added_at    TEXT    NOT NULL DEFAULT (${SQL_NOW}),
    updated_at  TEXT    NOT NULL DEFAULT (${SQL_NOW})
  ) STRICT;

  INSERT INTO books_new (id, title, author, summary, cover_url, text_url, shelf, last_page, page_count, added_at, updated_at)
    SELECT id, title, author, summary, cover_url, text_url, shelf, last_page, page_count, added_at, updated_at FROM books;

  DROP TABLE books;
  ALTER TABLE books_new RENAME TO books;
  CREATE INDEX books_shelf_updated_idx ON books (shelf, updated_at DESC);
  `,
  `
  -- Adds favourites. A favourite need not be on a shelf, so "shelf" becomes
  -- optional; every row must still be on a shelf, a favourite, or both.
  CREATE TABLE books_new (
    id           INTEGER PRIMARY KEY CHECK (id > 0),
    title        TEXT    NOT NULL CHECK (length(title) > 0),
    author       TEXT    NOT NULL,
    summary      TEXT,
    cover_url    TEXT,
    text_url     TEXT,
    shelf        TEXT    CHECK (shelf IS NULL OR shelf IN ('want-to-read', 'reading', 'finished', 'dnf')),
    is_favorite  INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    favorited_at TEXT,
    last_page    INTEGER NOT NULL DEFAULT 0 CHECK (last_page >= 0),
    page_count   INTEGER CHECK (page_count IS NULL OR page_count > 0),
    added_at     TEXT    NOT NULL DEFAULT (${SQL_NOW}),
    updated_at   TEXT    NOT NULL DEFAULT (${SQL_NOW}),
    CHECK (shelf IS NOT NULL OR is_favorite = 1)
  ) STRICT;

  INSERT INTO books_new (id, title, author, summary, cover_url, text_url, shelf, last_page, page_count, added_at, updated_at)
    SELECT id, title, author, summary, cover_url, text_url, shelf, last_page, page_count, added_at, updated_at FROM books;

  DROP TABLE books;
  ALTER TABLE books_new RENAME TO books;
  CREATE INDEX books_shelf_updated_idx ON books (shelf, updated_at DESC);
  CREATE INDEX books_favorites_idx ON books (favorited_at DESC) WHERE is_favorite = 1;
  `,
];

declare global {
  // Reuse one connection across hot reloads in development.
  var __shelfieDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  globalThis.__shelfieDb ??= openDatabase();
  return globalThis.__shelfieDb;
}

/**
 * Runs several statements as one unit: either all of their changes are saved
 * or none are. `BEGIN IMMEDIATE` takes the write lock up front.
 */
export function transaction<T>(work: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function openDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  migrate(db);

  process.once("exit", () => db.close());
  return db;
}

function migrate(db: DatabaseSync): void {
  // Several build workers may open the database at once; the write lock makes
  // them take turns, and the version is re-read once the lock is held.
  db.exec("BEGIN IMMEDIATE");
  try {
    const { user_version: currentVersion } = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    for (let version = currentVersion; version < MIGRATIONS.length; version++) {
      db.exec(MIGRATIONS[version]);
    }
    if (currentVersion < MIGRATIONS.length) {
      db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw new Error(`Failed to migrate the Shelfie database at ${DB_PATH}`, { cause: error });
  }
}
