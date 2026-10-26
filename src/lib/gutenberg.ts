import "server-only";

import { cacheLife } from "next/cache";

import { getDb } from "./db";
import { parseBookRecord, parseSearchFeed } from "./gutenberg-feeds";
import type { Book, BookListing } from "./types";

/**
 * Client for Project Gutenberg's own catalog.
 *
 * - Search uses the OPDS feed behind gutenberg.org's search box: it answers
 *   in under a second and ranks results by popularity. Results are cached
 *   with `use cache` for a few hours.
 * - Book details (summary, cover, text file) come from each book's RDF
 *   record. They are fetched once per book and then stored in SQLite.
 */

const CATALOG_URL = "https://www.gutenberg.org/ebooks/";
const REQUEST_TIMEOUT_MS = 15_000;
/** The search feed always returns 25 books per page. */
const SEARCH_PAGE_SIZE = 25;
/** Be gentle with Project Gutenberg: at most this many detail requests at once. */
const MAX_CONCURRENT_REQUESTS = 4;

export interface SearchResults {
  books: BookListing[];
  /** True if the search has more results than were returned. */
  hasMore: boolean;
}

/**
 * Returns the first `limit` results for a search of titles and authors. An
 * empty query lists the most downloaded books. Fetches as many feed pages as
 * needed; each feed page is cached separately, so asking for more results
 * later only downloads the new pages.
 */
export async function searchBooks(query: string, limit: number): Promise<SearchResults> {
  const books = new Map<number, BookListing>(); // keyed by id, in case pages overlap
  let feedPage = 1;
  let feedHasMore = true;

  // Collect one extra result so we know whether there are more to show.
  while (books.size <= limit && feedHasMore) {
    const page = await fetchSearchPage(query, feedPage++);
    for (const book of page.books) books.set(book.id, book);
    feedHasMore = page.hasNextPage && page.books.length > 0;
  }

  return {
    books: [...books.values()].slice(0, limit),
    hasMore: books.size > limit || feedHasMore,
  };
}

async function fetchSearchPage(query: string, page: number) {
  "use cache";
  cacheLife("hours");

  const url = new URL("search.opds/", CATALOG_URL);
  if (query) url.searchParams.set("query", query);
  else url.searchParams.set("sort_order", "downloads");
  if (page > 1) url.searchParams.set("start_index", String((page - 1) * SEARCH_PAGE_SIZE + 1));

  const response = await request(url);
  return parseSearchFeed(await response.text());
}

const inFlight = new Map<number, Promise<Book | null>>();

/**
 * Full details of a book, or null if Project Gutenberg has no such book.
 * Served from SQLite when possible; concurrent requests for the same book
 * share a single download.
 */
export async function getBookDetails(id: number): Promise<Book | null> {
  const cached = readCachedDetails(id);
  if (cached) return cached;

  let pending = inFlight.get(id);
  if (!pending) {
    pending = withRequestSlot(() => fetchBookRecord(id))
      .then((book) => {
        if (book) writeCachedDetails(book);
        return book;
      })
      .finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  return pending;
}

async function fetchBookRecord(id: number): Promise<Book | null> {
  const response = await request(new URL(`${id}.rdf`, CATALOG_URL));
  if (response.status === 404) return null;
  return parseBookRecord(await response.text());
}

async function request(url: URL): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Project Gutenberg request failed with status ${response.status}: ${url}`);
  }
  return response;
}

// ---- Concurrency limit -----------------------------------------------------

let activeRequests = 0;
const waitingRequests: (() => void)[] = [];

async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => waitingRequests.push(resolve));
  }
  activeRequests++;
  try {
    return await task();
  } finally {
    activeRequests--;
    waitingRequests.shift()?.();
  }
}

// ---- SQLite cache ------------------------------------------------------------

interface DetailsRow {
  id: number;
  title: string;
  author: string;
  summary: string | null;
  cover_url: string | null;
  text_url: string | null;
}

function readCachedDetails(id: number): Book | null {
  const row = getDb()
    .prepare("SELECT id, title, author, summary, cover_url, text_url FROM book_details WHERE id = ?")
    .get(id) as DetailsRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    coverUrl: row.cover_url,
    textUrl: row.text_url,
  };
}

function writeCachedDetails(book: Book): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO book_details (id, title, author, summary, cover_url, text_url)
       VALUES (:id, :title, :author, :summary, :coverUrl, :textUrl)`,
    )
    .run({
      id: book.id,
      title: book.title,
      author: book.author,
      summary: book.summary,
      coverUrl: book.coverUrl,
      textUrl: book.textUrl,
    });
}
