import styles from "./ReadingProgress.module.css";

interface ReadingProgressProps {
  lastPage: number;
  pageCount: number | null;
  /** A finished book always shows as complete (100%), however far it was read in the app. */
  finished?: boolean;
}

/**
 * Progress bar for a shelved book. Finished books show a full bar; other
 * books show nothing until they have been opened in the reader.
 */
export function ReadingProgress({ lastPage, pageCount, finished = false }: ReadingProgressProps) {
  if (!finished && (!pageCount || lastPage === 0)) return null;

  const percent = finished ? 100 : Math.min(100, Math.round((lastPage / pageCount!) * 100));

  return (
    <div className={styles.progress}>
      <div
        className={`${styles.track} ${finished ? styles.complete : ""}`}
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.label}>
        {finished ? (
          <>✓ Completed{pageCount ? ` · ${pageCount} pages` : ""} · 100%</>
        ) : (
          <>
            Page {lastPage} of {pageCount} · {percent}%
          </>
        )}
      </p>
    </div>
  );
}
