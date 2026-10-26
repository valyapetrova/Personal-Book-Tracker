import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/EmptyState";
import { AutoStartReading } from "@/components/reader/AutoStartReading";
import { ContinuousReader } from "@/components/reader/ContinuousReader";
import { RetryButton } from "@/components/RetryButton";
import { ShelfPicker } from "@/components/ShelfPicker";
import { getBookPages, TextNotAvailableError } from "@/lib/book-text";
import { getBookDetails } from "@/lib/gutenberg";
import { getLibraryBook } from "@/lib/library";
import type { Page } from "@/lib/reader";
import { getShelfInfo } from "@/lib/shelves";
import type { Book, LibraryBook } from "@/lib/types";
import { firstParam, parsePositiveInt } from "@/lib/validation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Reader",
};

/** Pages rendered on the server; the reader loads the rest while scrolling. */
const INITIAL_PAGES = 3;

export default function ReaderPage({ params, searchParams }: PageProps<"/read/[id]">) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <Reader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type ReaderData =
  | { status: "ok"; book: Book; saved: LibraryBook | null; pages: Page[] }
  | { status: "not-found" }
  | { status: "error"; book: Book | null; reason: "no-text" | "unreachable" };

/** Loads the book's details (from the library, else the catalog) and its paginated text. */
async function loadBook(bookId: number): Promise<ReaderData> {
  await connection();
  const saved = getLibraryBook(bookId);
  let book: Book | null = saved;
  try {
    book ??= await getBookDetails(bookId);
    if (!book) return { status: "not-found" };
    return { status: "ok", book, saved, pages: await getBookPages(book) };
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

  const { book, saved, pages } = data;
  // Without an explicit page, resume where the user left off.
  const requestedPage = parsePositiveInt(firstParam((await searchParams).page));
  const startPage = Math.min(requestedPage ?? Math.max(saved?.lastPage ?? 1, 1), pages.length);

  const back = saved?.shelf
    ? { href: `/shelves/${saved.shelf}`, label: `Back to “${getShelfInfo(saved.shelf).fullLabel}”` }
    : saved?.isFavorite
      ? { href: "/shelves/favorites", label: "Back to Favorites" }
      : { href: "/", label: "Back to Discover" };

  return (
    <div className={styles.reader}>
      <header className={styles.header}>
        <h1 className={styles.title}>{book.title}</h1>
        <p className={styles.author}>{book.author}</p>
        <div className={styles.shelf}>
          <ShelfPicker
            bookId={book.id}
            bookTitle={book.title}
            shelf={saved?.shelf ?? null}
            isFavorite={saved?.isFavorite ?? false}
            rating={saved?.rating ?? null}
            review={saved?.review ?? null}
            allowRemove={false}
          />
        </div>
      </header>

      {/* Opening a book that is on no shelf puts it on "Reading". */}
      <AutoStartReading bookId={book.id} shelf={saved?.shelf ?? null} />
      <article aria-label={book.title}>
        <ContinuousReader
          bookId={book.id}
          back={back}
          pageCount={pages.length}
          initialFirstPage={startPage}
          initialPages={pages.slice(startPage - 1, startPage - 1 + INITIAL_PAGES)}
          isShelved={saved !== null}
          isFinished={saved?.shelf === "finished"}
          bookTitle={book.title}
          rating={saved?.rating ?? null}
          review={saved?.review ?? null}
        />
      </article>
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
