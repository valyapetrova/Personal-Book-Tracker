import type { ReactNode } from "react";

import styles from "./BookGrid.module.css";

/** Responsive grid of book cards. Pass one `<li>` per book. */
export function BookGrid({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className={styles.grid}>
      {children}
    </ul>
  );
}

/** Placeholder grid shown while books are loading. */
export function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.grid} role="status" aria-label="Loading books">
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
