import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ShelfTabList, ShelfTabs } from "@/components/ShelfTabs";
import { countBooksByShelf } from "@/lib/library";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "My shelves",
};

/** Shared frame for the shelf pages: heading plus one tab per shelf. */
export default function ShelvesLayout({ children }: LayoutProps<"/shelves">) {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>My shelves</h1>
        <Suspense fallback={<ShelfTabList counts={null} />}>
          <ShelfTabsWithCounts />
        </Suspense>
      </header>
      {children}
    </div>
  );
}

async function ShelfTabsWithCounts() {
  await connection();
  return <ShelfTabs counts={countBooksByShelf()} />;
}
