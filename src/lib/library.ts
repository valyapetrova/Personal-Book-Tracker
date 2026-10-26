import "server-only";

import { getDb, SQL_NOW } from "./db";
import { SHELF_IDS, type ShelfId } from "./shelves";
import type { Book, ShelvedBook } from "./types";

/**
 * Data access for the user's library (the `books` table). Every write is a
 * single SQL statement, which SQLite applies atomically. All values are bound
 * as parameters, never interpolated into SQL.
 */

interface BookRow {
  id: number;
  title: string;
  author: string;
  summary: string | null;
  cover_url: string | null;
  text_url: string | null;
  shelf: ShelfId;
  last_page: number;
  page_count: number | null;
  added_at: string;
  updated_at: string;
}

const BOOK_COLUMNS = `id, title, author, summary, cover_url, text_url, shelf,
  last_page, page_count, added_at, updated_at`;

function toShelvedBook(row: BookRow): ShelvedBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    coverUrl: row.cover_url,
    textUrl: row.text_url,
    shelf: row.shelf,
    lastPage: row.last_page,
    pageCount: row.page_count,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

/** Books on one shelf, most recently touched first. */
export function listShelf(shelf: ShelfId): ShelvedBook[] {
  const rows = getDb()
    .prepare(`SELECT ${BOOK_COLUMNS} FROM books WHERE shelf = ? ORDER BY updated_at DESC, id`)
    .all(shelf) as unknown as BookRow[];
  return rows.map(toShelvedBook);
}

export function countBooksByShelf(): Record<ShelfId, number> {
  const counts = Object.fromEntries(SHELF_IDS.map((id) => [id, 0])) as Record<ShelfId, number>;
  const rows = getDb()
    .prepare("SELECT shelf, COUNT(*) AS total FROM books GROUP BY shelf")
    .all() as unknown as { shelf: ShelfId; total: number }[];
  for (const row of rows) counts[row.shelf] = row.total;
  return counts;
}

export function getShelvedBook(id: number): ShelvedBook | null {
  const row = getDb().prepare(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`).get(id) as
    | BookRow
    | undefined;
  return row ? toShelvedBook(row) : null;
}

/** Looks up which shelf (if any) each of the given books is on. */
export function getShelvesFor(ids: readonly number[]): Map<number, ShelfId> {
  if (ids.length === 0) return new Map();
  const rows = getDb()
    .prepare("SELECT id, shelf FROM books WHERE id IN (SELECT value FROM json_each(?))")
    .all(JSON.stringify(ids)) as unknown as { id: number; shelf: ShelfId }[];
  return new Map(rows.map((row) => [row.id, row.shelf]));
}

/**
 * Puts a book on a shelf. Adds it if it is new; otherwise moves it and
 * refreshes its details. Reading progress is kept when a book changes shelf.
 */
export function shelveBook(book: Book, shelf: ShelfId): void {
  getDb()
    .prepare(
      `INSERT INTO books (id, title, author, summary, cover_url, text_url, shelf)
       VALUES (:id, :title, :author, :summary, :coverUrl, :textUrl, :shelf)
       ON CONFLICT (id) DO UPDATE SET
         title      = excluded.title,
         author     = excluded.author,
         summary    = excluded.summary,
         cover_url  = excluded.cover_url,
         text_url   = excluded.text_url,
         shelf      = excluded.shelf,
         updated_at = ${SQL_NOW}`,
    )
    .run({
      id: book.id,
      title: book.title,
      author: book.author,
      summary: book.summary,
      coverUrl: book.coverUrl,
      textUrl: book.textUrl,
      shelf,
    });
}

/** Moves an already shelved book to another shelf. Returns false if the book is not shelved. */
export function moveBook(id: number, shelf: ShelfId): boolean {
  const result = getDb()
    .prepare(`UPDATE books SET shelf = ?, updated_at = ${SQL_NOW} WHERE id = ?`)
    .run(shelf, id);
  return result.changes > 0;
}

/** Removes a book (and its reading progress). Returns false if it was not shelved. */
export function removeBook(id: number): boolean {
  const result = getDb().prepare("DELETE FROM books WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Remembers the reader position. Does nothing for books that are not shelved. */
export function saveReadingProgress(id: number, page: number, pageCount: number): void {
  getDb()
    .prepare(
      `UPDATE books
       SET last_page = :page, page_count = :pageCount, updated_at = ${SQL_NOW}
       WHERE id = :id AND (last_page != :page OR page_count IS NOT :pageCount)`,
    )
    .run({ id, page, pageCount });
}
