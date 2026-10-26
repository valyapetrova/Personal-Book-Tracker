"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { shelveBookAction } from "@/app/actions";
import { getShelfInfo, type ShelfId } from "@/lib/shelves";
import { useReviewPrompt } from "../ReviewPrompt";
import { Stars } from "../Stars";
import type { BookcaseBook, BookcaseHandle } from "./bookcase-scene";
import styles from "./Bookcase.module.css";

interface HoveredBook {
  book: BookcaseBook;
  /** Position relative to the bookcase container. */
  x: number;
  y: number;
  /** Show the tooltip to the left of the pointer, near the right edge. */
  flip: boolean;
}

/** Feedback after a drag & drop, with a way to undo it. */
type Notice =
  | { kind: "moved"; book: BookcaseBook; from: ShelfId }
  | { kind: "error"; message: string };

const NOTICE_DURATION_MS = 8000;

/**
 * Interactive 3D bookcase showing every shelved book, with the DNF bin
 * beside it. Books can be dragged between shelves and into the bin. three.js
 * is loaded only when this component mounts, so other pages don't pay for it.
 */
export function Bookcase({ books }: { books: BookcaseBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<BookcaseHandle | null>(null);
  /** The latest books from the server, used to build the scene and to undo failed moves. */
  const booksRef = useRef(books);
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const [hovered, setHovered] = useState<HoveredBook | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const promptReview = useReviewPrompt();

  // Keep the scene in step with the server: after a move, books glide to their new place.
  useEffect(() => {
    booksRef.current = books;
    handleRef.current?.setBooks(books);
  }, [books]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    async function moveBook(book: BookcaseBook, from: ShelfId) {
      const result = await shelveBookAction(book.id, book.shelf);
      if (result.ok) {
        setNotice({ kind: "moved", book, from });
        // Just finished it: ask what the reader thought.
        if (book.shelf === "finished") {
          promptReview({ bookId: book.id, bookTitle: book.title, rating: book.rating, review: book.review, justFinished: true });
        }
      } else {
        // Put the book back where the server says it is.
        handleRef.current?.setBooks(booksRef.current);
        setNotice({ kind: "error", message: result.error });
      }
    }

    (async () => {
      const [{ createBookcase }] = await Promise.all([import("./bookcase-scene"), document.fonts.ready]);
      if (disposed) return;
      try {
        handleRef.current = createBookcase(
          container,
          booksRef.current,
          {
            onHover(book, clientX, clientY) {
              const rect = container.getBoundingClientRect();
              const x = clientX - rect.left;
              setHovered(book ? { book, x, y: clientY - rect.top, flip: x > rect.width - 280 } : null);
            },
            onOpen(book) {
              router.push(`/read/${book.id}`);
            },
            onMove(book, from) {
              void moveBook(book, from);
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
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // Both are stable, so the scene is built once per mount.
  }, [router, promptReview]);

  async function undo(book: BookcaseBook, from: ShelfId) {
    setNotice(null);
    const result = await shelveBookAction(book.id, from);
    if (!result.ok) setNotice({ kind: "error", message: result.error });
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.stage}
        role="img"
        aria-label={`Bookcase with ${books.filter((book) => book.shelf !== "dnf").length} books, and a DNF bin`}
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
            {hovered.book.rating !== null && <Stars rating={hovered.book.rating} />}
            <span className={styles.tooltipHint}>
              {getShelfInfo(hovered.book.shelf).fullLabel} · {isTouch ? "Tap again to read" : "Click to read"}
            </span>
          </div>
        )}
      </div>

      <div className={styles.notice} role="status" aria-live="polite">
        {notice?.kind === "moved" && (
          <>
            <span>
              Moved “{notice.book.title}” to {getShelfInfo(notice.book.shelf).fullLabel}.
            </span>
            <button type="button" className="button button-small" onClick={() => undo(notice.book, notice.from)}>
              Undo
            </button>
          </>
        )}
        {notice?.kind === "error" && <span className={styles.error}>{notice.message}</span>}
      </div>

      <p className={styles.hint}>
        {books.length === 0 ? (
          <>
            Your bookcase is empty. <Link href="/">Discover books</Link> and add them to a shelf.
          </>
        ) : isTouch ? (
          "Tap a book to pull it out, tap again to open it. Drag a book sideways to move it or drop it in the DNF bin."
        ) : (
          "Hover a book to pull it out, click to open it. Drag it to another shelf or into the DNF bin."
        )}
      </p>
    </div>
  );
}
