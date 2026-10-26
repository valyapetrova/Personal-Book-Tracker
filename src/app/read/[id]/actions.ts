"use server";

import { getBookPages } from "@/lib/book-text";
import { getBookDetails } from "@/lib/gutenberg";
import { getLibraryBook } from "@/lib/library";
import type { Page } from "@/lib/reader";
import { parsePositiveInt } from "@/lib/validation";

/** Most pages the reader may request at once. */
const MAX_PAGES_PER_REQUEST = 10;

export type ReaderPagesResult = { ok: true; pages: Page[] } | { ok: false; error: string };

/**
 * Loads more of a book while the user scrolls the reader. Read-only: the text
 * is normally already cached (in memory and in SQLite) from opening the book.
 */
export async function loadReaderPagesAction(
  bookId: number,
  fromPage: number,
  count: number,
): Promise<ReaderPagesResult> {
  const id = parsePositiveInt(bookId);
  const from = parsePositiveInt(fromPage);
  const size = parsePositiveInt(count);
  if (id === null || from === null || size === null) return { ok: false, error: "Invalid request." };

  try {
    const book = getLibraryBook(id) ?? (await getBookDetails(id));
    if (!book) return { ok: false, error: "Book not found." };
    const pages = await getBookPages(book);
    return { ok: true, pages: pages.slice(from - 1, from - 1 + Math.min(size, MAX_PAGES_PER_REQUEST)) };
  } catch (error) {
    console.error(`Could not load pages of book ${bookId}:`, error);
    return { ok: false, error: "Could not load more of the book." };
  }
}
