"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { saveProgressAction } from "@/app/actions";
import { loadReaderPagesAction } from "@/app/read/[id]/actions";
import type { Page } from "@/lib/reader";
import { parsePositiveInt } from "@/lib/validation";
import { FinishBookButton } from "./FinishBookButton";
import { ReaderText } from "./ReaderText";
import styles from "./ContinuousReader.module.css";

/** Pages fetched per request while scrolling. */
const PAGES_PER_LOAD = 3;
/** Start loading the next pages when the end of the text is this far below the screen. */
const PRELOAD_MARGIN = "0px 0px 1500px 0px";
/** Wait for scrolling to settle before saving progress. */
const SAVE_DELAY_MS = 800;

interface ContinuousReaderProps {
  bookId: number;
  /** Where the toolbar's back link leads, e.g. the book's shelf. */
  back: { href: string; label: string };
  pageCount: number;
  /** The page to start at, and the server-rendered pages from there on. */
  initialFirstPage: number;
  initialPages: Page[];
  /** Progress is only saved for books on a shelf. */
  isShelved: boolean;
  isFinished: boolean;
}

/** The pages currently in the DOM: a contiguous run starting at `first`. */
interface LoadedPages {
  first: number;
  pages: Page[];
}

/**
 * Infinite-scroll reader. More pages load automatically as the reader nears
 * the end of the text; earlier pages load on request. A sticky toolbar shows
 * the current page and lets the user jump anywhere in the book.
 */
export function ContinuousReader({
  bookId,
  back,
  pageCount,
  initialFirstPage,
  initialPages,
  isShelved,
  isFinished,
}: ContinuousReaderProps) {
  // Props only seed the state: a later server refresh (e.g. after changing
  // shelf) must not reset what the user has scrolled through.
  const [loaded, setLoaded] = useState<LoadedPages>(() => ({ first: initialFirstPage, pages: initialPages }));
  const [currentPage, setCurrentPage] = useState(initialFirstPage);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const toolbarRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  /** Page to scroll to once the next render has put it in the DOM. */
  const scrollTargetRef = useRef<number | null>(null);
  const unsavedPageRef = useRef<number | null>(null);

  const lastLoaded = loaded.first + loaded.pages.length - 1;
  const percent = Math.round((currentPage / pageCount) * 100);

  const fetchPages = useCallback(
    async (from: number, count: number): Promise<Page[] | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setStatus("loading");
      const result = await loadReaderPagesAction(bookId, from, count);
      busyRef.current = false;
      setStatus(result.ok ? "idle" : "error");
      return result.ok ? result.pages : null;
    },
    [bookId],
  );

  const loadNext = useCallback(async () => {
    const from = lastLoaded + 1;
    const pages = await fetchPages(from, PAGES_PER_LOAD);
    if (!pages) return;
    // Only append if nothing else (e.g. a jump) changed the loaded range meanwhile.
    setLoaded((current) =>
      current.first + current.pages.length === from ? { ...current, pages: [...current.pages, ...pages] } : current,
    );
  }, [fetchPages, lastLoaded]);

  async function loadPrevious() {
    const oldFirst = loaded.first;
    const from = Math.max(1, oldFirst - PAGES_PER_LOAD);
    const pages = await fetchPages(from, oldFirst - from);
    if (!pages) return;
    // Keep the reader looking at the same text after the earlier pages are added above it.
    scrollTargetRef.current = oldFirst;
    setLoaded((current) => (current.first === oldFirst ? { first: from, pages: [...pages, ...current.pages] } : current));
  }

  async function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requested = parsePositiveInt(new FormData(event.currentTarget).get("page"));
    if (requested === null) return;
    const target = Math.min(requested, pageCount);
    (document.activeElement as HTMLElement | null)?.blur();

    if (target >= loaded.first && target <= lastLoaded) {
      scrollToPage(target);
      return;
    }
    const pages = await fetchPages(target, PAGES_PER_LOAD);
    if (!pages) return;
    scrollTargetRef.current = target;
    setLoaded({ first: target, pages });
    setCurrentPage(target);
  }

  function scrollToPage(page: number) {
    textRef.current?.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: "start" });
  }

  // After earlier pages are added or the reader jumps, scroll to the right page.
  useLayoutEffect(() => {
    if (scrollTargetRef.current === null) return;
    scrollToPage(scrollTargetRef.current);
    scrollTargetRef.current = null;
  }, [loaded]);

  // Infinite scroll: load the next pages as the end of the text approaches.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || lastLoaded >= pageCount || status !== "idle") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadNext();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [lastLoaded, pageCount, status, loadNext]);

  // Work out which page is being read from the scroll position.
  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const sections = textRef.current?.querySelectorAll<HTMLElement>("[data-page]");
      if (!sections?.length) return;
      // The page whose top has passed a line a quarter of the way down the screen.
      const marker = (toolbarRef.current?.getBoundingClientRect().bottom ?? 0) + window.innerHeight * 0.25;
      let page = Number(sections[0].dataset.page);
      for (const section of sections) {
        if (section.getBoundingClientRect().top > marker) break;
        page = Number(section.dataset.page);
      }
      // A short final page may never reach the line; count the bottom of the book as the last page.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && lastLoaded === pageCount) page = pageCount;
      setCurrentPage(page);
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [loaded, lastLoaded, pageCount]);

  // Save reading progress once scrolling settles, and when leaving the reader.
  // (The URL is deliberately not updated while scrolling: rewriting it can
  // cancel a navigation the user has just started.)
  const saveProgress = useEffectEvent(() => {
    const page = unsavedPageRef.current;
    if (page === null) return;
    unsavedPageRef.current = null;
    saveProgressAction(bookId, page, pageCount).then((result) => {
      if (!result.ok) console.warn(result.error);
    });
  });

  useEffect(() => {
    if (!isShelved) return;
    unsavedPageRef.current = currentPage;
    const timer = setTimeout(() => saveProgress(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentPage, isShelved]);

  useEffect(() => () => saveProgress(), []);

  return (
    <div className={styles.reader}>
      <div ref={toolbarRef} className={styles.toolbar}>
        {/* In the toolbar, so leaving never requires scrolling back through the book. */}
        <Link href={back.href} className={styles.back}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
        <form className={styles.jump} onSubmit={jumpToPage}>
          <label htmlFor="reader-page">Page</label>
          <input
            // Re-mount on page change so the field always shows the current page.
            key={currentPage}
            id="reader-page"
            name="page"
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            defaultValue={currentPage}
            required
            className={styles.pageInput}
          />
          <span>of {pageCount}</span>
          <button type="submit" className="button button-small">
            Go
          </button>
        </form>
        <span className={styles.percent}>{percent}% read</span>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Position in book"
          aria-valuemin={1}
          aria-valuemax={pageCount}
          aria-valuenow={currentPage}
        >
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {loaded.first > 1 && (
        <button
          type="button"
          className={`button ${styles.earlier}`}
          onClick={loadPrevious}
          disabled={status === "loading"}
        >
          ↑ Show earlier pages
        </button>
      )}

      <div ref={textRef} className={styles.text}>
        {loaded.pages.map((blocks, index) => {
          const page = loaded.first + index;
          return (
            <section key={page} data-page={page} aria-label={`Page ${page}`} className={styles.page}>
              {page > 1 && (
                <p className={styles.pageMarker} aria-hidden="true">
                  <span>{page}</span>
                </p>
              )}
              {blocks.length > 0 ? (
                <ReaderText blocks={blocks} />
              ) : (
                <p>This book does not contain any readable text.</p>
              )}
            </section>
          );
        })}
      </div>

      {lastLoaded < pageCount ? (
        <div ref={sentinelRef} className={styles.loadState}>
          {status === "error" ? (
            <>
              <p role="alert">The next pages could not be loaded.</p>
              <button type="button" className="button" onClick={() => setStatus("idle")}>
                Try again
              </button>
            </>
          ) : (
            <p role="status">Loading more…</p>
          )}
        </div>
      ) : (
        <section className={styles.end} aria-label="End of book">
          <p className={styles.endTitle}>The End</p>
          <p>You have reached the end of the book.</p>
          <FinishBookButton bookId={bookId} isFinished={isFinished} />
        </section>
      )}
    </div>
  );
}
