"use client";

import { useOptimistic, useState, useTransition } from "react";

import { shelveBookAction } from "@/app/actions";

interface FinishBookButtonProps {
  bookId: number;
  isFinished: boolean;
}

/** Shown on the last page: moves the book to the "Finished" shelf in one click. */
export function FinishBookButton({ bookId, isFinished }: FinishBookButtonProps) {
  const [optimisticFinished, setOptimisticFinished] = useOptimistic(isFinished);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (optimisticFinished) {
    return <p role="status">✓ On your “Finished” shelf. Well done!</p>;
  }

  function markFinished() {
    setError(null);
    startTransition(async () => {
      setOptimisticFinished(true);
      const result = await shelveBookAction(bookId, "finished");
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <button type="button" className="button button-primary" onClick={markFinished} disabled={isPending}>
        Mark as finished
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
