import { test as base, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";

import type { ShelfId } from "../../../src/lib/shelves";
import { E2E_DATABASE } from "./paths";

/** Real Project Gutenberg books used by the tests. */
export const BOOKS = {
  pride: { id: 1342, title: "Pride and Prejudice", author: "Jane Austen" },
  frankenstein: { id: 84, title: "Frankenstein; or, The modern Prometheus", author: "Mary Wollstonecraft Shelley" },
  alice: { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
  sherlock: { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle" },
  dracula: { id: 345, title: "Dracula", author: "Bram Stoker" },
} as const;

type TestBook = (typeof BOOKS)[keyof typeof BOOKS];

export interface SeedOptions {
  shelf?: ShelfId | null;
  favorite?: boolean;
  lastPage?: number;
  pageCount?: number | null;
  rating?: number | null;
  review?: string | null;
}

export interface LibraryRow {
  shelf: ShelfId | null;
  isFavorite: boolean;
  rating: number | null;
  review: string | null;
  lastPage: number;
}

/** Direct access to the test server's database, to set up and check state. */
export class TestLibrary {
  constructor(private readonly db: DatabaseSync) {}

  /** Empties the library. Downloaded book texts and catalog details are kept as a cache. */
  reset() {
    this.db.exec("DELETE FROM books");
  }

  seed(book: TestBook, options: SeedOptions = {}) {
    this.db
      .prepare(
        `INSERT INTO books (id, title, author, summary, cover_url, text_url, shelf, is_favorite, favorited_at,
                            last_page, page_count, rating, review)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, ?, ?, ?, ?)`,
      )
      .run(
        book.id,
        book.title,
        book.author,
        `A summary of “${book.title}”.`,
        `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`,
        `https://www.gutenberg.org/ebooks/${book.id}.txt.utf-8`,
        options.shelf === undefined ? "want-to-read" : options.shelf,
        options.favorite ? 1 : 0,
        options.favorite ? 1 : 0,
        options.lastPage ?? 0,
        options.pageCount ?? null,
        options.rating ?? null,
        options.review ?? null,
      );
  }

  get(id: number): LibraryRow | null {
    const row = this.db
      .prepare("SELECT shelf, is_favorite, rating, review, last_page FROM books WHERE id = ?")
      .get(id) as { shelf: ShelfId | null; is_favorite: number; rating: number | null; review: string | null; last_page: number } | undefined;
    return row
      ? { shelf: row.shelf, isFavorite: row.is_favorite === 1, rating: row.rating, review: row.review, lastPage: row.last_page }
      : null;
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS total FROM books").get() as { total: number }).total;
  }
}

/** Every test starts with an empty library (`library` fixture). */
export const test = base.extend<{ library: TestLibrary }>({
  library: [
    async ({ request }, use) => {
      // Make sure the server has created (and migrated) its database first.
      await request.get("/shelves/reading");
      const db = new DatabaseSync(E2E_DATABASE);
      const library = new TestLibrary(db);
      library.reset();
      await use(library);
      db.close();
    },
    { auto: true },
  ],
});

export { expect };
