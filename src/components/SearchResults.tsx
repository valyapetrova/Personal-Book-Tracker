import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { searchBooks } from "@/lib/gutenberg";
import { getShelvesFor } from "@/lib/library";
import { BookCard, SummarySkeleton } from "./BookCard";
import { BookGrid } from "./BookGrid";
import { BookSummary } from "./BookSummary";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";
import { RetryButton } from "./RetryButton";
import { ShelfPicker } from "./ShelfPicker";
import styles from "./SearchResults.module.css";

interface SearchResultsProps {
  /** Search text; empty shows the most popular books. */
  query: string;
  page: number;
}

/**
 * Search results from Project Gutenberg, annotated with the shelf each book
 * is on. Titles and covers appear at once; descriptions stream in per card.
 */
export async function SearchResults({ query, page }: SearchResultsProps) {
  const results = await searchBooks(query, page).catch((error: unknown) => {
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
        title={query ? `No books found for “${query}”` : "No more books to show"}
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

  // Shelf membership changes with every action, so read it per request.
  await connection();
  const shelves = getShelvesFor(results.books.map((book) => book.id));

  return (
    <section aria-labelledby="results-heading" className={styles.results}>
      <h2 id="results-heading" className={styles.heading}>
        {query ? `Results for “${query}”` : "Popular on Project Gutenberg"}
      </h2>

      <BookGrid>
        {results.books.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              summary={
                <Suspense fallback={<SummarySkeleton />}>
                  <BookSummary bookId={book.id} />
                </Suspense>
              }
              actions={
                <ShelfPicker bookId={book.id} bookTitle={book.title} shelf={shelves.get(book.id) ?? null}>
                  <Link href={`/read/${book.id}`} className="button button-small">
                    Read now
                  </Link>
                </ShelfPicker>
              }
            />
          </li>
        ))}
      </BookGrid>

      {(page > 1 || results.hasNextPage) && (
        <Pagination
          page={page}
          hasNextPage={results.hasNextPage}
          hrefFor={(target) => searchHref(query, target)}
          label="Search result pages"
        />
      )}
    </section>
  );
}

function searchHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/?${search}` : "/";
}
