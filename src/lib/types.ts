import type { ShelfId } from "./shelves";

/** A book as Shelfie knows it, normalised from Project Gutenberg's catalog. */
export interface Book {
  /** Project Gutenberg ebook number. Stable and unique, so it is our primary key. */
  id: number;
  title: string;
  /** Display-ready author names, e.g. "Jane Austen". */
  author: string;
  /** Short description of the book, if the catalog has one. */
  summary: string | null;
  coverUrl: string | null;
  /** Plain-text edition used by the in-app reader. */
  textUrl: string | null;
}

/** A search result: the basics, before the full details have been loaded. */
export type BookListing = Pick<Book, "id" | "title" | "author" | "coverUrl">;

/** A book in the user's library: on a shelf, a favourite, or both. */
export interface LibraryBook extends Book {
  /** null for a favourite that is not on any shelf. */
  shelf: ShelfId | null;
  isFavorite: boolean;
  /** Last page opened in the reader; 0 means the book has not been opened yet. */
  lastPage: number;
  /** Number of reader pages, known once the book has been opened. */
  pageCount: number | null;
  /** ISO 8601 timestamps (UTC). */
  addedAt: string;
  updatedAt: string;
}

/** A library book that is on one of the shelves. */
export interface ShelvedBook extends LibraryBook {
  shelf: ShelfId;
}

/** Where a book stands in the user's library, as shown on its card. */
export interface LibraryStatus {
  shelf: ShelfId | null;
  isFavorite: boolean;
}
