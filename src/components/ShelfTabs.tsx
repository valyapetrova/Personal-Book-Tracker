"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { SHELVES, type ShelfId } from "@/lib/shelves";
import styles from "./ShelfTabs.module.css";

/** Number of books per shelf; null while the counts are loading. */
type ShelfCounts = Record<ShelfId, number> | null;

/**
 * Tab bar for switching between shelves; the active tab follows the URL.
 * Reading the URL makes this dynamic, so render it inside `<Suspense>` with
 * `<ShelfTabList />` as the fallback.
 */
export function ShelfTabs({ counts }: { counts: ShelfCounts }) {
  return <ShelfTabList counts={counts} activeShelf={useSelectedLayoutSegment()} />;
}

/**
 * The tab bar markup: the bookcase (all books) followed by one tab per shelf.
 * `activeShelf` is null on the bookcase page; when undefined (still loading),
 * no tab is highlighted.
 */
export function ShelfTabList({ counts, activeShelf }: { counts: ShelfCounts; activeShelf?: string | null }) {
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : null;

  return (
    <nav aria-label="Shelves">
      <ul className={styles.tabs}>
        <li>
          <Link
            href="/shelves"
            data-shelf="bookcase"
            aria-current={activeShelf === null ? "page" : undefined}
            className={styles.tab}
          >
            <span className={styles.label}>Bookcase</span>
            <span className={styles.count}>
              {total ?? "–"}
              <span className="visually-hidden"> books</span>
            </span>
          </Link>
        </li>
        {SHELVES.map(({ id, label }) => (
          <li key={id}>
            <Link
              href={`/shelves/${id}`}
              data-shelf={id}
              aria-current={activeShelf === id ? "page" : undefined}
              className={styles.tab}
            >
              <span className={styles.label}>{label}</span>
              <span className={styles.count}>
                {counts ? counts[id] : "–"}
                <span className="visually-hidden"> books</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
