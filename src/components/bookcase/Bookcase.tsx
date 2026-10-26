"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getShelfInfo } from "@/lib/shelves";
import type { BookcaseBook } from "./bookcase-scene";
import styles from "./Bookcase.module.css";

interface HoveredBook {
  book: BookcaseBook;
  /** Position relative to the bookcase container. */
  x: number;
  y: number;
  /** Show the tooltip to the left of the pointer, near the right edge. */
  flip: boolean;
}

/**
 * Interactive 3D bookcase showing every shelved book. three.js is loaded
 * only when this component mounts, so other pages don't pay for it.
 */
export function Bookcase({ books }: { books: BookcaseBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const [hovered, setHovered] = useState<HoveredBook | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let handle: { dispose(): void } | null = null;

    (async () => {
      const [{ createBookcase }] = await Promise.all([import("./bookcase-scene"), document.fonts.ready]);
      if (disposed) return;
      try {
        handle = createBookcase(
          container,
          books,
          {
            onHover(book, clientX, clientY) {
              const rect = container.getBoundingClientRect();
              const x = clientX - rect.left;
              setHovered(book ? { book, x, y: clientY - rect.top, flip: x > rect.width - 280 } : null);
            },
            onOpen(book) {
              router.push(`/read/${book.id}`);
            },
          },
          {
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            fontFamily: getComputedStyle(container).getPropertyValue("--font-serif") || "Georgia, serif",
          },
        );
        setIsTouch(window.matchMedia("(pointer: coarse)").matches);
        setStatus("ready");
      } catch (error) {
        console.warn("3D bookcase unavailable:", error);
        setStatus("unsupported");
      }
    })();

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [books, router]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.stage}
        role="img"
        aria-label={`Bookcase with ${books.length} ${books.length === 1 ? "book" : "books"}`}
      >
        {status === "loading" && <p className={styles.message}>Building your bookcase…</p>}
        {status === "unsupported" && (
          <p className={styles.message}>
            Your browser can’t show the 3D bookcase. Use the shelf tabs above to see your books.
          </p>
        )}
        {hovered && (
          <div
            className={`${styles.tooltip} ${hovered.flip ? styles.tooltipFlipped : ""}`}
            style={{ left: hovered.x, top: hovered.y }}
            aria-hidden="true"
          >
            <strong>{hovered.book.title}</strong>
            <span>{hovered.book.author}</span>
            <span className={styles.tooltipHint}>
              {getShelfInfo(hovered.book.shelf).label} · {isTouch ? "Tap again to read" : "Click to read"}
            </span>
          </div>
        )}
      </div>

      <p className={styles.hint}>
        {books.length === 0 ? (
          <>
            Your bookcase is empty. <Link href="/">Discover books</Link> and add them to a shelf.
          </>
        ) : isTouch ? (
          "Tap a book to pull it out, tap again to open it."
        ) : (
          "Hover a book to pull it out, click to open it. Drag to look around."
        )}
      </p>
    </div>
  );
}
