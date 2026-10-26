import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { FinishBookButton } from "@/components/reader/FinishBookButton";
import { KeyboardPager } from "@/components/reader/KeyboardPager";
import { PageJump } from "@/components/reader/PageJump";
import { ProgressSaver } from "@/components/reader/ProgressSaver";
import { ReaderText } from "@/components/reader/ReaderText";
import { RetryButton } from "@/components/RetryButton";
import { ShelfPicker } from "@/components/ShelfPicker";
import { getBookPages, TextNotAvailableError } from "@/lib/book-text";
import { getBookDetails } from "@/lib/gutenberg";
import { getShelvedBook } from "@/lib/library";
import type { Page } from "@/lib/reader";
import { getShelfInfo } from "@/lib/shelves";
import type { Book, ShelvedBook } from "@/lib/types";
import { firstParam, parsePositiveInt } from "@/lib/validation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Reader",
};

export default function ReaderPage({ params, searchParams }: PageProps<"/read/[id]">) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <Reader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type ReaderData =
  | { status: "ok"; book: Book; shelved: ShelvedBook | null; pages: Page[] }
  | { status: "not-found" }
  | { status: "error"; book: Book | null; reason: "no-text" | "unreachable" };

/** Loads the book's details (from the library, else the catalog) and its paginated text. */
async function loadBook(bookId: number): Promise<ReaderData> {
  await connection();
  const shelved = getShelvedBook(bookId);
  let book: Book | null = shelved;
  try {
    book ??= await getBookDetails(bookId);
    if (!book) return { status: "not-found" };
    return { status: "ok", book, shelved, pages: await getBookPages(book) };
  } catch (error) {
    if (error instanceof TextNotAvailableError) return { status: "error", book, reason: "no-text" };
    console.error(`Could not open book ${bookId}:`, error);
    return { status: "error", book, reason: "unreachable" };
  }
}

async function Reader({ params, searchParams }: Pick<PageProps<"/read/[id]">, "params" | "searchParams">) {
  const bookId = parsePositiveInt((await params).id);
  if (bookId === null) notFound();

  const data = await loadBook(bookId);
  if (data.status === "not-found") notFound();
  if (data.status === "error") return <ReaderError bookId={bookId} book={data.book} reason={data.reason} />;

  const { book, shelved, pages } = data;
  const pageCount = pages.length;
  // Without an explicit page, resume where the user left off.
  const requestedPage = parsePositiveInt(firstParam((await searchParams).page));
  const pageNumber = Math.min(requestedPage ?? Math.max(shelved?.lastPage ?? 1, 1), pageCount);
  const blocks = pages[pageNumber - 1];
  const percent = Math.round((pageNumber / pageCount) * 100);

  const pageHref = (page: number) => `/read/${book.id}?page=${page}`;
  const back = shelved
    ? { href: `/shelves/${shelved.shelf}`, label: `Back to “${getShelfInfo(shelved.shelf).label}”` }
    : { href: "/", label: "Back to Discover" };

  return (
    <div className={styles.reader}>
      <header className={styles.header}>
        <Link href={back.href} className={styles.back}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
        <h1 className={styles.title}>{book.title}</h1>
        <p className={styles.author}>{book.author}</p>
        <div className={styles.shelf}>
          <ShelfPicker bookId={book.id} bookTitle={book.title} shelf={shelved?.shelf ?? null} allowRemove={false} />
        </div>
        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Position in book"
            aria-valuemin={1}
            aria-valuemax={pageCount}
            aria-valuenow={pageNumber}
          >
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span>
            Page {pageNumber} of {pageCount} · {percent}%
          </span>
        </div>
      </header>

      <article className={styles.text} aria-label={`${book.title}, page ${pageNumber}`}>
        {blocks.length > 0 ? (
          <ReaderText blocks={blocks} />
        ) : (
          <p>This book does not contain any readable text.</p>
        )}
      </article>

      {pageNumber === pageCount && (
        <section className={styles.end} aria-label="End of book">
          <p className={styles.endTitle}>The End</p>
          <p>You have reached the end of “{book.title}”.</p>
          <FinishBookButton bookId={book.id} isFinished={shelved?.shelf === "finished"} />
        </section>
      )}

      <footer className={styles.footer}>
        <Pagination
          page={pageNumber}
          hasNextPage={pageNumber < pageCount}
          hrefFor={pageHref}
          label="Book pages"
          status={`${pageNumber} / ${pageCount}`}
        />
        {pageCount > 1 && <PageJump bookId={book.id} page={pageNumber} pageCount={pageCount} />}
        <p className={styles.hint}>Tip: use the ← and → keys to turn pages.</p>
      </footer>

      {shelved && <ProgressSaver bookId={book.id} page={pageNumber} pageCount={pageCount} />}
      <KeyboardPager
        previousHref={pageNumber > 1 ? pageHref(pageNumber - 1) : null}
        nextHref={pageNumber < pageCount ? pageHref(pageNumber + 1) : null}
      />
    </div>
  );
}

interface ReaderErrorProps {
  bookId: number;
  book: Book | null;
  reason: "no-text" | "unreachable";
}

function ReaderError({ bookId, book, reason }: ReaderErrorProps) {
  return (
    <div className={styles.reader}>
      <EmptyState
        role="alert"
        title={book ? `“${book.title}” could not be opened` : "This book could not be opened"}
        action={
          <div className={styles.errorActions}>
            {reason === "unreachable" && <RetryButton />}
            <a
              href={`https://www.gutenberg.org/ebooks/${bookId}`}
              className="button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on gutenberg.org
            </a>
          </div>
        }
      >
        {reason === "no-text"
          ? "This book has no plain-text edition (it may be an audiobook), so it can’t be shown in the reader."
          : "Project Gutenberg could not be reached. Check your connection and try again."}
      </EmptyState>
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className={styles.reader} role="status">
      <p className={styles.loading}>Opening book…</p>
      <div className={styles.skeleton} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
