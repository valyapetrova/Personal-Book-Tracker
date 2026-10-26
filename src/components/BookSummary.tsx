import { getBookDetails } from "@/lib/gutenberg";

/**
 * A book's short description, loaded from Project Gutenberg (or the local
 * cache). Render it inside `<Suspense>` so search results appear first and
 * descriptions stream in as they arrive. Renders nothing if unavailable.
 */
export async function BookSummary({ bookId }: { bookId: number }) {
  const book = await getBookDetails(bookId).catch((error: unknown) => {
    console.error(`Could not load details for book ${bookId}:`, error);
    return null;
  });
  return book?.summary ?? null;
}
