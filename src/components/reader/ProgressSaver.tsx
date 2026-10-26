"use client";

import { useEffect } from "react";

import { saveProgressAction } from "@/app/actions";

interface ProgressSaverProps {
  bookId: number;
  page: number;
  pageCount: number;
}

/**
 * Saves the reader position whenever the page changes. Saving happens after
 * render, never during it, so link prefetching can't record pages the user
 * never actually opened.
 */
export function ProgressSaver({ bookId, page, pageCount }: ProgressSaverProps) {
  useEffect(() => {
    saveProgressAction(bookId, page, pageCount).then((result) => {
      if (!result.ok) console.warn(result.error);
    });
  }, [bookId, page, pageCount]);

  return null;
}
