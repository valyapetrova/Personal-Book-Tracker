import styles from "./Stars.module.css";

const STAR_PATH = "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z";

/** One star, filled gold or outlined. */
export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={`${styles.star} ${filled ? styles.filled : ""} ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

/** A read-only 1-5 star rating. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={`${styles.stars} ${className ?? ""}`} role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon key={value} filled={value <= rating} />
      ))}
    </span>
  );
}
