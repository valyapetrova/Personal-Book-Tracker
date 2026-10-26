import "server-only";

import { getDb, SQL_NOW, transaction } from "./db";
import { SHELF_IDS, type ShelfId } from "./shelves";
import type { Book, LibraryBook, LibraryStatus, ShelvedBook } from "./types";

/**
 * Data access for the user's library (the `books` table): books on shelves
 * and favourites. A row exists while a book is on a shelf or a favourite
 * (the database enforces this). Single-statement writes are atomic; writes
 * that need several statements use a transaction. All values are bound as
 * parameters, never interpolated into SQL.
 */

interface BookRow {
  id: number;
  title: string;
  author: string;
  summary: string | null;
  cover_url: string | null;
  text_url: string | null;
  shelf: ShelfId | null;
  is_favorite: number;
  last_page: number;
  page_count: number | null;
  added_at: string;
  updated_at: string;
}

const BOOK_COLUMNS = `id, title, author, summary, cover_url, text_url, shelf, is_favorite,
  last_page, page_count, added_at, updated_at`;

export type LibraryCounts = Record<ShelfId, number> & { favorites: number };

function toLibraryBook(row: BookRow): LibraryBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    coverUrl: row.cover_url,
    textUrl: row.text_url,
    shelf: row.shelf,
    isFavorite: row.is_favorite === 1,
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
  return rows.map(toLibraryBook) as ShelvedBook[];
}

/** Favourite books, most recently liked first. */
export function listFavorites(): LibraryBook[] {
  const rows = getDb()
    .prepare(`SELECT ${BOOK_COLUMNS} FROM books WHERE is_favorite = 1 ORDER BY favorited_at DESC, id`)
    .all() as unknown as BookRow[];
  return rows.map(toLibraryBook);
}

export function countLibrary(): LibraryCounts {
  const counts = Object.fromEntries(SHELF_IDS.map((id) => [id, 0])) as Record<ShelfId, number>;
  const rows = getDb()
    .prepare("SELECT shelf, COUNT(*) AS total FROM books WHERE shelf IS NOT NULL GROUP BY shelf")
    .all() as unknown as { shelf: ShelfId; total: number }[];
  for (const row of rows) counts[row.shelf] = row.total;
  const { total: favorites } = getDb().prepare("SELECT COUNT(*) AS total FROM books WHERE is_favorite = 1").get() as {
    total: number;
  };
  return { ...counts, favorites };
}

/** A book from the library (on a shelf or a favourite), or null. */
export function getLibraryBook(id: number): LibraryBook | null {
  const row = getDb().prepare(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`).get(id) as
    | BookRow
    | undefined;
  return row ? toLibraryBook(row) : null;
}

/** The shelf and favourite state of each of the given books (if in the library). */
export function getStatusesFor(ids: readonly number[]): Map<number, LibraryStatus> {
  if (ids.length === 0) return new Map();
  const rows = getDb()
    .prepare("SELECT id, shelf, is_favorite FROM books WHERE id IN (SELECT value FROM json_each(?))")
    .all(JSON.stringify(ids)) as unknown as { id: number; shelf: ShelfId | null; is_favorite: number }[];
  return new Map(rows.map((row) => [row.id, { shelf: row.shelf, isFavorite: row.is_favorite === 1 }]));
}

/**
 * Puts a book on a shelf. Adds it if it is new; otherwise moves it and
 * refreshes its details. Reading progress and favourite state are kept.
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
    .run(bookParams(book, { shelf }));
}

/** Moves a library book to a shelf. Returns false if the book is not in the library. */
export function moveBook(id: number, shelf: ShelfId): boolean {
  const result = getDb()
    .prepare(`UPDATE books SET shelf = ?, updated_at = ${SQL_NOW} WHERE id = ?`)
    .run(shelf, id);
  return result.changes > 0;
}

/**
 * Takes a book off the shelves. A favourite stays in the library (and keeps
 * its progress); any other book is deleted together with its progress.
 */
export function removeBook(id: number): void {
  transaction((db) => {
    db.prepare(`UPDATE books SET shelf = NULL, updated_at = ${SQL_NOW} WHERE id = ? AND is_favorite = 1`).run(id);
    db.prepare("DELETE FROM books WHERE id = ? AND is_favorite = 0").run(id);
  });
}

/** Marks a book as a favourite, adding it to the library if needed. */
export function addFavorite(book: Book): void {
  getDb()
    .prepare(
      `INSERT INTO books (id, title, author, summary, cover_url, text_url, is_favorite, favorited_at)
       VALUES (:id, :title, :author, :summary, :coverUrl, :textUrl, 1, ${SQL_NOW})
       ON CONFLICT (id) DO UPDATE SET
         is_favorite  = 1,
         favorited_at = ${SQL_NOW}`,
    )
    .run(bookParams(book));
}

/** Marks a library book as a favourite. Returns false if the book is not in the library. */
export function favoriteLibraryBook(id: number): boolean {
  const result = getDb()
    .prepare(`UPDATE books SET is_favorite = 1, favorited_at = ${SQL_NOW} WHERE id = ?`)
    .run(id);
  return result.changes > 0;
}

/** Un-favourites a book; if it is on no shelf either, it leaves the library. */
export function removeFavorite(id: number): void {
  transaction((db) => {
    db.prepare("DELETE FROM books WHERE id = ? AND shelf IS NULL").run(id);
    db.prepare("UPDATE books SET is_favorite = 0, favorited_at = NULL WHERE id = ?").run(id);
  });
}

/** Remembers the reader position. Does nothing for books that are not in the library. */
export function saveReadingProgress(id: number, page: number, pageCount: number): void {
  getDb()
    .prepare(
      `UPDATE books
       SET last_page = :page, page_count = :pageCount, updated_at = ${SQL_NOW}
       WHERE id = :id AND (last_page != :page OR page_count IS NOT :pageCount)`,
    )
    .run({ id, page, pageCount });
}

function bookParams(book: Book, extra: Record<string, string> = {}) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    summary: book.summary,
    coverUrl: book.coverUrl,
    textUrl: book.textUrl,
    ...extra,
  };
}
