import type { ReactNode } from "react";

import type { BookListing } from "@/lib/types";
import { BookCover } from "./BookCover";
import styles from "./BookCard.module.css";

interface BookCardProps {
  book: BookListing;
  /** Short description: plain text, or a component that streams it in. */
  summary?: ReactNode;
  /** Extra information under the description, e.g. reading progress. */
  details?: ReactNode;
  /** Controls pinned to the bottom of the card. */
  actions: ReactNode;
}

/** Presentational card showing a book's cover, title, author and description. */
export function BookCard({ book, summary, details, actions }: BookCardProps) {
  return (
    <article className={styles.card}>
      <BookCover book={book} className={styles.cover} />
      <div className={styles.info}>
        <h3 className={styles.title}>{book.title}</h3>
        <p className={styles.author}>{book.author}</p>
        {summary && <div className={styles.summary}>{summary}</div>}
        {details}
      </div>
      <div className={styles.actions}>{actions}</div>
    </article>
  );
}

/** Placeholder lines shown while a description is loading. */
export function SummarySkeleton() {
  return (
    <span className={styles.summarySkeleton} role="status" aria-label="Loading description">
      <span />
      <span />
      <span />
    </span>
  );
}
