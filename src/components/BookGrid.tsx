import type { ReactNode } from "react";

import styles from "./BookGrid.module.css";

interface GridOptions {
  /** `4` caps the grid at four books per row on wide screens; otherwise it fits as many as possible. */
  columns?: 4;
}

function gridClass({ columns }: GridOptions): string {
  return columns === 4 ? `${styles.grid} ${styles.fourColumns}` : styles.grid;
}

/** Responsive grid of book cards. Pass one `<li>` per book. */
export function BookGrid({ children, columns }: GridOptions & { children: ReactNode }) {
  return (
    <ul role="list" className={gridClass({ columns })}>
      {children}
    </ul>
  );
}

/** Placeholder grid shown while books are loading. */
export function BookGridSkeleton({ count = 6, columns }: GridOptions & { count?: number }) {
  return (
    <div className={gridClass({ columns })} role="status" aria-label="Loading books">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonCard}>
          <div className={styles.skeletonCover} />
          <div className={styles.skeletonLines}>
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
