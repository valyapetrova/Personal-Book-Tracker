"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { ReviewDialog } from "./ReviewDialog";

export interface ReviewRequest {
  bookId: number;
  bookTitle: string;
  rating: number | null;
  review: string | null;
  /** True right after finishing the book: the dialog then says "You finished …!". */
  justFinished?: boolean;
}

const ReviewPromptContext = createContext<(request: ReviewRequest) => void>(() => {});

/**
 * Owns the one review dialog for the whole app. Cards, the reader and the
 * bookcase ask for it through `useReviewPrompt()`; because it lives here, it
 * stays open even when the card that opened it leaves the page (e.g. a book
 * moved from the "Reading" list to "Finished").
 */
export function ReviewPromptProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ReviewRequest | null>(null);

  return (
    <ReviewPromptContext value={setRequest}>
      {children}
      {request && (
        <ReviewDialog
          key={request.bookId}
          bookId={request.bookId}
          bookTitle={request.bookTitle}
          initialRating={request.rating}
          initialReview={request.review}
          heading={request.justFinished ? `You finished “${request.bookTitle}”!` : undefined}
          onClose={() => setRequest(null)}
        />
      )}
    </ReviewPromptContext>
  );
}

/** Opens the review dialog for a book. */
export function useReviewPrompt(): (request: ReviewRequest) => void {
  return useContext(ReviewPromptContext);
}
