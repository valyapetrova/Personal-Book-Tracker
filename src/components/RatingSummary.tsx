"use client";

import { useReviewPrompt } from "./ReviewPrompt";
import { StarIcon, Stars } from "./Stars";
import styles from "./RatingSummary.module.css";

interface RatingSummaryProps {
  bookId: number;
  bookTitle: string;
  rating: number | null;
  review: string | null;
  /** Offer "Rate this book" (finished books); otherwise only existing ratings are shown. */
  canRate: boolean;
}

/** The user's stars and review on a book card, with a way to add or edit them. */
export function RatingSummary({ bookId, bookTitle, rating, review, canRate }: RatingSummaryProps) {
  const promptReview = useReviewPrompt();
  if (rating === null && !canRate) return null;
  const edit = () => promptReview({ bookId, bookTitle, rating, review });

  return (
    <div className={styles.summary}>
      {rating !== null ? (
        <>
          <div className={styles.row}>
            <Stars rating={rating} />
            <button type="button" className={styles.link} onClick={edit}>
              Edit<span className="visually-hidden"> your review of “{bookTitle}”</span>
            </button>
          </div>
          {review && <p className={styles.review}>“{review}”</p>}
        </>
      ) : (
        <button type="button" className={styles.rate} onClick={edit}>
          <StarIcon filled={false} />
          Rate this book
        </button>
      )}
    </div>
  );
}
