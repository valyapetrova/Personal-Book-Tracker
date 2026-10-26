import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookCard } from "@/components/BookCard";
import { BookGrid, BookGridSkeleton } from "@/components/BookGrid";
import { EmptyState } from "@/components/EmptyState";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ShelfPicker } from "@/components/ShelfPicker";
import { listFavorites } from "@/lib/library";

export const metadata: Metadata = {
  title: "Favorites",
};

/** `/shelves/favorites`: every book the user has hearted, on a shelf or not. */
export default function FavoritesPage() {
  return (
    <Suspense fallback={<BookGridSkeleton count={3} />}>
      <FavoriteBooks />
    </Suspense>
  );
}

async function FavoriteBooks() {
  await connection();
  const books = listFavorites();

  if (books.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        action={
          <Link href="/" className="button button-primary">
            Discover books
          </Link>
        }
      >
        Tap the heart on any book to add it to your favorites.
      </EmptyState>
    );
  }

  return (
    <section aria-label="Favorites">
      <BookGrid>
        {books.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              summary={book.summary}
              details={<ReadingProgress lastPage={book.lastPage} pageCount={book.pageCount} />}
              actions={
                <ShelfPicker bookId={book.id} bookTitle={book.title} shelf={book.shelf} isFavorite={book.isFavorite}>
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
