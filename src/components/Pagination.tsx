import Link from "next/link";

import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  hasNextPage: boolean;
  /** Builds the URL for a given page number. */
  hrefFor: (page: number) => string;
  label: string;
  /** Optional text shown between the buttons, defaults to "Page N". */
  status?: string;
}

/** Previous / next navigation shared by search results and the reader. */
export function Pagination({ page, hasNextPage, hrefFor, label, status }: PaginationProps) {
  return (
    <nav aria-label={label} className={styles.pagination}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="button">
          <span aria-hidden="true">←</span> Previous
        </Link>
      ) : (
        <span className="button" aria-disabled="true">
          <span aria-hidden="true">←</span> Previous
        </span>
      )}
      <span className={styles.status}>{status ?? `Page ${page}`}</span>
      {hasNextPage ? (
        <Link href={hrefFor(page + 1)} rel="next" className="button">
          Next <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="button" aria-disabled="true">
          Next <span aria-hidden="true">→</span>
        </span>
      )}
    </nav>
  );
}
