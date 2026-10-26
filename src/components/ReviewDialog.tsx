"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { saveReviewAction } from "@/app/actions";
import { REVIEW_MAX_LENGTH } from "@/lib/validation";
import { StarIcon } from "./Stars";
import styles from "./ReviewDialog.module.css";

const RATING_WORDS = ["", "Didn’t like it", "It was OK", "Liked it", "Really liked it", "Loved it"];

interface ReviewDialogProps {
  bookId: number;
  bookTitle: string;
  initialRating: number | null;
  initialReview: string | null;
  /** e.g. "You finished “Emma”!" when shown right after finishing a book. */
  heading?: string;
  onClose(): void;
}

/**
 * Modal dialog asking for a 1-5 star rating and a short note. It opens when
 * mounted, so render it only while it should be shown. Built on the native
 * <dialog> element: focus stays inside it and Escape closes it.
 */
export function ReviewDialog({ bookId, bookTitle, initialRating, initialReview, heading, onClose }: ReviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState(initialRating ?? 0);
  const [preview, setPreview] = useState(0);
  const [note, setNote] = useState(initialReview ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // Close it if the page is navigated away from or hidden.
    return () => dialog.close();
  }, []);

  function save(nextRating: number | null, nextNote: string) {
    setError(null);
    startTransition(async () => {
      const result = await saveReviewAction(bookId, nextRating, nextNote);
      if (result.ok) dialogRef.current?.close();
      else setError(result.error);
    });
  }

  const shown = preview || rating;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      // Ignore a stale close event if the dialog has been reopened since
      // (React mounts effects twice in development).
      onClose={() => !dialogRef.current?.open && onClose()}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (rating) save(rating, note);
        }}
      >
        <h2 id={titleId} className={styles.title}>
          {heading ?? `Your review of “${bookTitle}”`}
        </h2>

        <fieldset className={styles.rating}>
          <legend className={styles.legend}>How would you rate it?</legend>
          <div className={styles.stars} onMouseLeave={() => setPreview(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className={styles.starLabel} onMouseEnter={() => setPreview(value)}>
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="visually-hidden"
                />
                <StarIcon filled={value <= shown} className={styles.star} />
                <span className="visually-hidden">
                  {value} {value === 1 ? "star" : "stars"}: {RATING_WORDS[value]}
                </span>
              </label>
            ))}
          </div>
          <p className={styles.ratingWords} aria-hidden="true">
            {RATING_WORDS[shown] || "Pick 1 to 5 stars"}
          </p>
        </fieldset>

        <label htmlFor={noteId} className={styles.noteLabel}>
          A short note <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id={noteId}
          className={styles.note}
          rows={4}
          maxLength={REVIEW_MAX_LENGTH}
          placeholder="What did you think? A favourite moment, a quote, who you’d recommend it to…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className={styles.counter} aria-hidden="true">
          {note.length} / {REVIEW_MAX_LENGTH}
        </p>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          {initialRating !== null && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => save(null, "")}
              disabled={isPending}
            >
              Remove rating
            </button>
          )}
          <button type="button" className="button" onClick={() => dialogRef.current?.close()} disabled={isPending}>
            {initialRating === null ? "Not now" : "Cancel"}
          </button>
          <button type="submit" className="button button-primary" disabled={!rating || isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
