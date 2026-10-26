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

/** The tab bar markup. Without `activeShelf`, no tab is highlighted. */
export function ShelfTabList({ counts, activeShelf }: { counts: ShelfCounts; activeShelf?: string | null }) {
  return (
    <nav aria-label="Shelves">
      <ul className={styles.tabs}>
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
