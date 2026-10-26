import "server-only";

import { getDb } from "./db";
import { extractBookBody, paginate, toBlocks, type Page } from "./reader";
import type { Book } from "./types";

/**
 * Loads book texts for the reader. Each text is downloaded from Project
 * Gutenberg once and stored in SQLite, so re-opening a book is instant and
 * works even if Gutenberg is unreachable.
 */

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_TEXT_BYTES = 20 * 1024 * 1024;
/** Paginated books kept in memory, so turning pages does not re-parse the text. */
const PAGE_CACHE_SIZE = 5;

const pageCache = new Map<number, Page[]>();

/** The book exists but has no plain-text edition (e.g. an audiobook). */
export class TextNotAvailableError extends Error {
  constructor(url: string) {
    super(`No plain-text edition at ${url}`);
    this.name = "TextNotAvailableError";
  }
}

/** Returns the book split into reader pages, downloading the text if needed. */
export async function getBookPages(book: Pick<Book, "id" | "textUrl">): Promise<Page[]> {
  const cached = pageCache.get(book.id);
  if (cached) return cached;

  const pages = paginate(toBlocks(await getBookText(book)));
  pageCache.set(book.id, pages);
  if (pageCache.size > PAGE_CACHE_SIZE) {
    // Maps iterate in insertion order, so the first key is the oldest entry.
    pageCache.delete(pageCache.keys().next().value!);
  }
  return pages;
}

async function getBookText(book: Pick<Book, "id" | "textUrl">): Promise<string> {
  const row = getDb().prepare("SELECT content FROM book_texts WHERE book_id = ?").get(book.id) as
    | { content: string }
    | undefined;
  if (row) return row.content;

  const text = extractBookBody(await download(book.textUrl ?? defaultTextUrl(book.id)));
  getDb()
    .prepare("INSERT OR REPLACE INTO book_texts (book_id, content) VALUES (?, ?)")
    .run(book.id, text);
  return text;
}

function defaultTextUrl(id: number): string {
  return `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;
}

async function download(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (response.status === 404) throw new TextNotAvailableError(url);
  if (!response.ok) {
    throw new Error(`Project Gutenberg responded with status ${response.status} for ${url}`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_TEXT_BYTES) {
    throw new Error(`Book text at ${url} is too large (${bytes.byteLength} bytes)`);
  }
  return decode(bytes, response.headers.get("content-type"));
}

/** Most texts are UTF-8, but some older ones are served as ISO-8859-1. */
function decode(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
