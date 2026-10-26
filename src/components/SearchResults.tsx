import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { searchBooks } from "@/lib/gutenberg";
import { getStatusesFor } from "@/lib/library";
import { BookCard, SummarySkeleton } from "./BookCard";
import { BookGrid } from "./BookGrid";
import { BookSummary } from "./BookSummary";
import { EmptyState } from "./EmptyState";
import { LoadMoreButton } from "./LoadMoreButton";
import { RatingSummary } from "./RatingSummary";
import { RetryButton } from "./RetryButton";
import { ShelfPicker } from "./ShelfPicker";
import styles from "./SearchResults.module.css";

/** Books shown at first, and added by each "Find more books" click. */
export const BOOKS_PER_BATCH = 20;
/** Upper bound on how many results one page will render. */
export const MAX_BOOKS = 400;

interface SearchResultsProps {
  /** Search text; empty shows the most popular books. */
  query: string;
  /** How many results to show (a multiple of BOOKS_PER_BATCH). */
  count: number;
}

/**
 * Search results from Project Gutenberg, annotated with the shelf each book
 * is on. Titles and covers appear at once; descriptions stream in per card.
 */
export async function SearchResults({ query, count }: SearchResultsProps) {
  const results = await searchBooks(query, count).catch((error: unknown) => {
    console.error("Book search failed:", error);
    return null;
  });

  if (!results) {
    return (
      <EmptyState role="alert" title="Search is unavailable right now" action={<RetryButton />}>
        Project Gutenberg’s catalogue could not be reached. Check your connection and try again.
      </EmptyState>
    );
  }

  if (results.books.length === 0) {
    return (
      <EmptyState
        title={`No books found for “${query}”`}
        action={
          <Link href="/" className="button">
            Back to popular books
          </Link>
        }
      >
        Check the spelling, or try an author’s last name or a single word from the title.
      </EmptyState>
    );
  }

  // Shelves and favourites change with every action, so read them per request.
  await connection();
  const statuses = getStatusesFor(results.books.map((book) => book.id));

  return (
    <section aria-labelledby="results-heading" className={styles.results}>
      <h2 id="results-heading" className={styles.heading}>
        {query ? `Results for “${query}”` : "Popular on Project Gutenberg"}
      </h2>

      <BookGrid columns={4}>
        {results.books.map((book) => {
          const status = statuses.get(book.id);
          return (
          <li key={book.id}>
            <BookCard
              book={book}
              summary={
                <Suspense fallback={<SummarySkeleton />}>
                  <BookSummary bookId={book.id} />
                </Suspense>
              }
              details={
                status && (
                  <RatingSummary
                    bookId={book.id}
                    bookTitle={book.title}
                    rating={status.rating}
                    review={status.review}
                    canRate={status.shelf === "finished"}
                  />
                )
              }
              actions={
                <ShelfPicker
                  bookId={book.id}
                  bookTitle={book.title}
                  shelf={status?.shelf ?? null}
                  isFavorite={status?.isFavorite ?? false}
                  rating={status?.rating ?? null}
                  review={status?.review ?? null}
                >
                  <Link href={`/read/${book.id}`} className="button button-small">
                    Read now
                  </Link>
                </ShelfPicker>
              }
            />
          </li>
          );
        })}
      </BookGrid>

      <div className={styles.more}>
        {results.hasMore && count < MAX_BOOKS ? (
          <LoadMoreButton count={count + BOOKS_PER_BATCH} />
        ) : (
          <p className={styles.end}>
            {results.books.length === 1 ? "That’s the only match." : `That’s all ${results.books.length} books.`}
          </p>
        )}
      </div>
    </section>
  );
}
