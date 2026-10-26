import styles from "./ReadingProgress.module.css";

interface ReadingProgressProps {
  lastPage: number;
  pageCount: number | null;
}

/** Progress bar for a shelved book. Renders nothing until the book has been opened. */
export function ReadingProgress({ lastPage, pageCount }: ReadingProgressProps) {
  if (!pageCount || lastPage === 0) return null;

  const percent = Math.min(100, Math.round((lastPage / pageCount) * 100));

  return (
    <div className={styles.progress}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.label}>
        Page {lastPage} of {pageCount} · {percent}%
      </p>
    </div>
  );
}
