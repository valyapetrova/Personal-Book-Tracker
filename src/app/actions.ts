"use server";

import { refresh } from "next/cache";

import { getBookDetails } from "@/lib/gutenberg";
import * as library from "@/lib/library";
import { isShelfId, type ShelfId } from "@/lib/shelves";
import { parsePositiveInt, REVIEW_MAX_LENGTH, ValidationError } from "@/lib/validation";

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

/**
 * Called when a book is opened in the reader: a book that is not on any shelf
 * yet goes onto "Reading". Books already on a shelf keep it.
 */
export async function startReadingAction(bookId: number): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    if (id === null) throw new ValidationError("Invalid book id.");
    const saved = library.getLibraryBook(id);
    if (saved?.shelf) return { ok: true };

    const book = saved ?? (await getBookDetails(id));
    if (!book) throw new ValidationError("This book does not exist on Project Gutenberg.");
    if (!library.startReading(book)) return { ok: true };
  } catch (error) {
    return failure(error, "Could not add the book to your Reading shelf.");
  }
  refresh();
  return { ok: true };
}

/** Saves a 1-5 star rating and an optional short review (null rating clears both). */
export async function saveReviewAction(bookId: number, rating: number | null, review: string): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    if (id === null) throw new ValidationError("Invalid book id.");
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      throw new ValidationError("Choose a rating from 1 to 5 stars.");
    }
    if (typeof review !== "string") throw new ValidationError("Invalid review.");
    const note = review.trim();
    if (note.length > REVIEW_MAX_LENGTH) {
      throw new ValidationError(`Keep the review under ${REVIEW_MAX_LENGTH} characters.`);
    }
    if (!library.saveReview(id, rating, rating === null ? null : note || null)) {
      throw new ValidationError("Add the book to a shelf before rating it.");
    }
  } catch (error) {
    return failure(error, "Could not save your review. Please try again.");
  }
  refresh();
  return { ok: true };
}

/** Adds a book to, or removes it from, the user's favourites. */
export async function setFavoriteAction(bookId: number, favorite: boolean): Promise<ActionResult> {
  try {
    const id = parsePositiveInt(bookId);
    if (id === null) throw new ValidationError("Invalid book id.");
    if (typeof favorite !== "boolean") throw new ValidationError("Invalid favourite value.");

    if (!favorite) {
      library.removeFavorite(id);
    } else if (!library.favoriteLibraryBook(id)) {
      // Not in the library yet: its details come from Project Gutenberg, never from the client.
      const book = await getBookDetails(id);
      if (!book) throw new ValidationError("This book does not exist on Project Gutenberg.");
      library.addFavorite(book);
    }
  } catch (error) {
    return failure(error, "Could not update your favourites. Please try again.");
  }
  refresh();
  return { ok: true };
}

/**
 * Takes a book off the user's shelves. Non-favourites are deleted with their
 * reading progress; favourites stay in the Favourites list.
 */
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
