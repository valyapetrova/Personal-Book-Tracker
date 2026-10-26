"use server";

import { refresh } from "next/cache";

import { getBookDetails } from "@/lib/gutenberg";
import * as library from "@/lib/library";
import { isShelfId, type ShelfId } from "@/lib/shelves";
import { parsePositiveInt, ValidationError } from "@/lib/validation";

/**
 * Server Actions: the only way the UI changes data. Arguments arrive from the
 * network, so each one is validated at runtime despite its TypeScript type.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Adds a book to a shelf, or moves it there if it is already shelved. */
export async function shelveBookAction(bookId: number, shelf: ShelfId): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    if (id === null) throw new ValidationError("Invalid book id.");
    if (!isShelfId(shelf)) throw new ValidationError("Unknown shelf.");

    if (!library.moveBook(id, shelf)) {
      // A new book: its details come from Project Gutenberg, never from the client.
      const book = await getBookDetails(id);
      if (!book) throw new ValidationError("This book does not exist on Project Gutenberg.");
      library.shelveBook(book, shelf);
    }
  } catch (error) {
    return failure(error, "Could not update your shelves. Please try again.");
  }
  refresh();
  return { ok: true };
}

/** Removes a book from the user's shelves, together with its reading progress. */
export async function removeBookAction(bookId: number): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    if (id === null) throw new ValidationError("Invalid book id.");
    library.removeBook(id);
  } catch (error) {
    return failure(error, "Could not remove the book. Please try again.");
  }
  refresh();
  return { ok: true };
}

/**
 * Remembers the page the user is reading. Runs in the background while the
 * user reads, so it does not refresh the page.
 */
export async function saveProgressAction(
  bookId: number,
  page: number,
  pageCount: number,
): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    const validPage = parsePositiveInt(page);
    const validPageCount = parsePositiveInt(pageCount);
    if (id === null || validPage === null || validPageCount === null || validPage > validPageCount) {
      throw new ValidationError("Invalid reading progress.");
    }
    library.saveReadingProgress(id, validPage, validPageCount);
  } catch (error) {
    return failure(error, "Could not save your reading progress.");
  }
  return { ok: true };
}

function failure(error: unknown, fallbackMessage: string): ActionResult {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error(fallbackMessage, error);
  return { ok: false, error: fallbackMessage };
}
