import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ShelfTabList, ShelfTabs } from "@/components/ShelfTabs";
import { countLibrary } from "@/lib/library";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "My shelves",
};

/**
 * Shared frame for the bookcase (the home page) and the shelf pages: the page,
 * with one tab per shelf in a column beside it.
 */
export default function ShelvesLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`container ${styles.page}`}>
      {/* The bookcase speaks for itself, so the heading is only for screen readers. */}
      <h1 className="visually-hidden">My shelves</h1>
      {/* Before the page in the DOM, so the shelves come first for keyboard and screen-reader users. */}
      <div className={styles.side}>
        <Suspense fallback={<ShelfTabList counts={null} />}>
          <ShelfTabsWithCounts />
        </Suspense>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

async function ShelfTabsWithCounts() {
  await connection();
  return <ShelfTabs counts={countLibrary()} />;
}
