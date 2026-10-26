"use client";

import { useEffect } from "react";

import { startReadingAction } from "@/app/actions";
import type { ShelfId } from "@/lib/shelves";

interface AutoStartReadingProps {
  bookId: number;
  /** The book's shelf when the reader opened, or null if it is on none. */
  shelf: ShelfId | null;
}

/**
 * Puts a book that is on no shelf onto "Reading" once it is actually opened
 * in the reader. Runs after render (never during it), so prefetching a link
 * to the reader does not shelve anything. Renders nothing.
 */
export function AutoStartReading({ bookId, shelf }: AutoStartReadingProps) {
  useEffect(() => {
    if (shelf !== null) return;
    startReadingAction(bookId).then((result) => {
      if (!result.ok) console.warn(result.error);
    });
  }, [bookId, shelf]);

  return null;
}
