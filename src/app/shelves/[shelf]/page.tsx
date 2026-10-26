import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookCard } from "@/components/BookCard";
import { BookGrid, BookGridSkeleton } from "@/components/BookGrid";
import { EmptyState } from "@/components/EmptyState";
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
  const { label, emptyMessage } = getShelfInfo(shelf);

  if (books.length === 0) {
    return (
      <EmptyState
        title={`Your “${label}” shelf is empty`}
        action={
          <Link href="/" className="button button-primary">
            Discover books
          </Link>
        }
      >
        {emptyMessage}
      </EmptyState>
    );
  }

  return (
    <section aria-label={`${label} shelf`}>
      <BookGrid>
        {books.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              summary={book.summary}
              details={<ReadingProgress lastPage={book.lastPage} pageCount={book.pageCount} />}
              actions={
                <ShelfPicker bookId={book.id} bookTitle={book.title} shelf={book.shelf}>
                  <Link href={`/read/${book.id}`} className="button button-small button-primary">
                    {book.lastPage > 0 ? "Continue reading" : "Start reading"}
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
