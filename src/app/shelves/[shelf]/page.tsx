import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookCard } from "@/components/BookCard";
import { BookGrid, BookGridSkeleton } from "@/components/BookGrid";
import { EmptyState } from "@/components/EmptyState";
import { RatingSummary } from "@/components/RatingSummary";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ShelfPicker } from "@/components/ShelfPicker";
import { listShelf } from "@/lib/library";
import { getShelfInfo, isShelfId, SHELF_IDS } from "@/lib/shelves";

/** The three shelves are known up front, so their page shells are prerendered. */
export function generateStaticParams() {
  return SHELF_IDS.map((shelf) => ({ shelf }));
}

export default function ShelfPage({ params }: PageProps<"/shelves/[shelf]">) {
  return (
    <Suspense fallback={<BookGridSkeleton count={3} />}>
      {params.then(({ shelf }) => (
        <ShelfBooks shelf={shelf} />
      ))}
    </Suspense>
  );
}

async function ShelfBooks({ shelf }: { shelf: string }) {
  if (!isShelfId(shelf)) notFound();

  await connection();
  const books = listShelf(shelf);
  const { fullLabel, emptyMessage } = getShelfInfo(shelf);

  if (books.length === 0) {
    return (
      <EmptyState
        title={`Your “${fullLabel}” shelf is empty`}
        action={
          shelf === "dnf" ? (
            <Link href="/shelves" className="button button-primary">
              Open the bookcase
            </Link>
          ) : (
            <Link href="/" className="button button-primary">
              Discover books
            </Link>
          )
        }
      >
        {emptyMessage}
      </EmptyState>
    );
  }

  return (
    <section aria-label={`${fullLabel} shelf`}>
      <BookGrid>
        {books.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              summary={book.summary}
              details={
                <>
                  <RatingSummary
                    bookId={book.id}
                    bookTitle={book.title}
                    rating={book.rating}
                    review={book.review}
                    canRate={book.shelf === "finished"}
                  />
                  <ReadingProgress
                    lastPage={book.lastPage}
                    pageCount={book.pageCount}
                    finished={book.shelf === "finished"}
                  />
                </>
              }
              actions={
                <ShelfPicker
                  bookId={book.id}
                  bookTitle={book.title}
                  shelf={book.shelf}
                  isFavorite={book.isFavorite}
                  rating={book.rating}
                  review={book.review}
                >
                  {/* A finished book starts again from the beginning. */}
                  <Link
                    href={book.shelf === "finished" ? `/read/${book.id}?page=1` : `/read/${book.id}`}
                    className="button button-small button-primary"
                  >
                    {book.shelf === "finished" ? "Read again" : book.lastPage > 0 ? "Continue reading" : "Start reading"}
                  </Link>
                </ShelfPicker>
              }
            />
          </li>
        ))}
      </BookGrid>
    </section>
  );
}
