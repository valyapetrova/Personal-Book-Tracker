import { Suspense } from "react";

import { BookGridSkeleton } from "@/components/BookGrid";
import { SearchBar } from "@/components/SearchBar";
import { BOOKS_PER_BATCH, MAX_BOOKS, SearchResults } from "@/components/SearchResults";
import { firstParam, parsePositiveInt } from "@/lib/validation";
import styles from "./page.module.css";

const MAX_QUERY_LENGTH = 200;

type SearchParams = Awaited<PageProps<"/">["searchParams"]>;

function readSearch(params: SearchParams) {
  // How many results to show: a whole number of batches, within limits.
  const requested = parsePositiveInt(firstParam(params.count)) ?? BOOKS_PER_BATCH;
  const count = Math.min(Math.ceil(requested / BOOKS_PER_BATCH) * BOOKS_PER_BATCH, MAX_BOOKS);
  return {
    query: (firstParam(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    count,
  };
}

/**
 * Discover page: search bar plus results (or popular books when no search
 * has been made). The heading and search bar are part of the static shell,
 * so they appear instantly; results stream in once Project Gutenberg responds.
 */
export default function DiscoverPage({ searchParams }: PageProps<"/">) {
  const search = searchParams.then(readSearch);

  return (
    <div className={`container ${styles.page}`}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Find your next great read</h1>
        <p className={styles.lead}>
          Search over 70,000 free public-domain books from Project Gutenberg, keep track of them on
          your shelves and read them right here.
        </p>
        <SearchBar />
      </section>

      <Suspense fallback={<BookGridSkeleton columns={4} count={BOOKS_PER_BATCH} />}>
        {search.then(({ query, count }) => (
          // A fresh key for every search shows the skeleton straight away
          // instead of leaving the previous results on screen. Loading more
          // results for the same search keeps the current ones visible.
          <Suspense key={query} fallback={<BookGridSkeleton columns={4} count={BOOKS_PER_BATCH} />}>
            <SearchResults query={query} count={count} />
          </Suspense>
        ))}
      </Suspense>
    </div>
  );
}
