"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { BOOKCASE_SHELVES, SHELVES, type ShelfId } from "@/lib/shelves";
import styles from "./ShelfTabs.module.css";

/** Number of books per shelf and of favourites; null while the counts are loading. */
type ShelfCounts = (Record<ShelfId, number> & { favorites: number }) | null;

/**
 * Tab bar for switching between shelves; the active tab follows the URL.
 * Reading the URL makes this dynamic, so render it inside `<Suspense>` with
 * `<ShelfTabList />` as the fallback.
 */
export function ShelfTabs({ counts }: { counts: ShelfCounts }) {
  return <ShelfTabList counts={counts} activeShelf={useSelectedLayoutSegment()} />;
}

/**
 * The tab bar markup: the bookcase (all books), one tab per shelf, and favourites.
 * `activeShelf` is null on the bookcase page; when undefined (still loading),
 * no tab is highlighted.
 */
export function ShelfTabList({ counts, activeShelf }: { counts: ShelfCounts; activeShelf?: string | null }) {
  // The bookcase holds the three reading shelves; the DNF bin is counted on its own tab.
  const total = counts ? BOOKCASE_SHELVES.reduce((sum, shelf) => sum + counts[shelf.id], 0) : null;

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
        {SHELVES.map(({ id, label, fullLabel }) => (
          <li key={id}>
            <Link
              href={`/shelves/${id}`}
              data-shelf={id}
              title={fullLabel !== label ? fullLabel : undefined}
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
        <li>
          <Link
            href="/shelves/favorites"
            data-shelf="favorites"
            aria-current={activeShelf === "favorites" ? "page" : undefined}
            className={styles.tab}
          >
            <svg className={styles.heart} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
            </svg>
            <span className={styles.label}>Favorites</span>
            <span className={styles.count}>
              {counts ? counts.favorites : "–"}
              <span className="visually-hidden"> books</span>
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
