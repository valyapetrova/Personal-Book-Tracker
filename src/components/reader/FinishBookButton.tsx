"use client";

import { useOptimistic, useState, useTransition } from "react";

import { shelveBookAction } from "@/app/actions";
import { RatingSummary } from "../RatingSummary";
import { useReviewPrompt } from "../ReviewPrompt";

interface FinishBookButtonProps {
  bookId: number;
  bookTitle: string;
  isFinished: boolean;
  rating: number | null;
  review: string | null;
}

/**
 * Shown on the last page: moves the book to the "Finished" shelf in one click
 * and asks for a rating. Once finished, shows the rating (or a way to add one).
 */
export function FinishBookButton({ bookId, bookTitle, isFinished, rating, review }: FinishBookButtonProps) {
  const [optimisticFinished, setOptimisticFinished] = useOptimistic(isFinished);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const promptReview = useReviewPrompt();

  function markFinished() {
    setError(null);
    startTransition(async () => {
      setOptimisticFinished(true);
      const result = await shelveBookAction(bookId, "finished");
      if (!result.ok) setError(result.error);
      else promptReview({ bookId, bookTitle, rating, review, justFinished: true });
    });
  }

  return (
    <>
      {optimisticFinished ? (
        <>
          <p role="status">✓ On your “Finished” shelf. Well done!</p>
          <RatingSummary bookId={bookId} bookTitle={bookTitle} rating={rating} review={review} canRate />
        </>
      ) : (
        <button type="button" className="button button-primary" onClick={markFinished} disabled={isPending}>
          Mark as finished
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
