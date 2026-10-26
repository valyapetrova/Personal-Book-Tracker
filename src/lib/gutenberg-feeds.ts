import { XMLParser } from "fast-xml-parser";

import type { Book, BookListing } from "./types";
import { BOOK_LIMITS } from "./validation";

/**
 * Parsers for Project Gutenberg's own catalog feeds:
 *
 * - The OPDS search feed (`/ebooks/search.opds/?query=…`): the same fast,
 *   popularity-ranked search as gutenberg.org. Entries only carry an id,
 *   title and author.
 * - The per-book RDF record (`/ebooks/{id}.rdf`): full details, including
 *   the summary and the list of downloadable files.
 *
 * These functions are pure (XML in, data out), so they are easy to test.
 */

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Keep values as text: a title like "1984" must not become a number.
  parseTagValue: false,
});

/** Covers live at a predictable URL; books without one get a placeholder in the UI. */
export function coverUrlFor(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

/** Parses one page of the OPDS search feed. */
export function parseSearchFeed(xml: string): { books: BookListing[]; hasNextPage: boolean } {
  const feed = at(parser.parse(xml), "feed");
  if (!feed) throw new Error("Unexpected response from the Project Gutenberg search feed");

  const books: BookListing[] = [];
  for (const entry of asArray(at(feed, "entry"))) {
    // Book entries have ids like ".../ebooks/1342.opds". Other entries are
    // "Authors" / "Subjects" shortcuts or a "No records found." message.
    const id = Number(/\/ebooks\/(\d+)\.opds$/.exec(text(at(entry, "id")))?.[1]);
    if (!id) continue;
    books.push({
      id,
      title: truncate(collapseWhitespace(text(at(entry, "title"))) || "Untitled", BOOK_LIMITS.title),
      author: truncate(collapseWhitespace(text(at(entry, "content"))) || "Unknown author", BOOK_LIMITS.author),
      coverUrl: coverUrlFor(id),
    });
  }

  const hasNextPage = asArray(at(feed, "link")).some((link) => at(link, "@rel") === "next");
  return { books, hasNextPage };
}

/** Parses a book's RDF record. Returns null if the record does not describe a book. */
export function parseBookRecord(xml: string): Book | null {
  const ebook = at(parser.parse(xml), "rdf:RDF", "pgterms:ebook");
  const id = Number(/ebooks\/(\d+)$/.exec(text(at(ebook, "@rdf:about")))?.[1]);
  if (!ebook || !id) return null;

  // Only real authors: translators and editors are listed under other tags.
  const authors = asArray(at(ebook, "dcterms:creator"))
    .map((creator) => formatAuthorName(text(at(creator, "pgterms:agent", "pgterms:name"))))
    .filter(Boolean);

  const files = asArray(at(ebook, "dcterms:hasFormat")).map((format) => {
    const file = at(format, "pgterms:file");
    return {
      url: text(at(file, "@rdf:about")),
      types: asArray(at(file, "dcterms:format")).map((type) => text(at(type, "rdf:Description", "rdf:value"))),
    };
  });

  // Prefer UTF-8 plain text; zipped editions cannot be read in the browser.
  const textFile = files
    .filter((file) => file.types.some((type) => type.startsWith("text/plain")) && !file.url.endsWith(".zip"))
    .sort((a, b) => Number(b.types.join().includes("utf-8")) - Number(a.types.join().includes("utf-8")))[0];

  return {
    id,
    title: truncate(collapseWhitespace(text(at(ebook, "dcterms:title"))) || "Untitled", BOOK_LIMITS.title),
    author: truncate(authors.join(", ") || "Unknown author", BOOK_LIMITS.author),
    summary: formatSummary(text(at(ebook, "pgterms:marc520"))),
    coverUrl: files.find((file) => file.url.endsWith(".cover.medium.jpg"))?.url ?? null,
    textUrl: textFile?.url ?? null,
  };
}

/** Catalog names are "Last, First[, extra]"; display them as "First Last". */
export function formatAuthorName(name: string): string {
  const withoutNotes = name.replace(/\s*\(.*?\)\s*/g, " "); // "Wells, H. G. (Herbert George)"
  const [last, first, ...rest] = withoutNotes.split(",").map((part) => part.trim());
  // Keep suffixes like "Jr." but drop titles such as "graf" ("Tolstoy, Leo, graf").
  const suffixes = rest.filter((part) => /^(Jr|Sr)\.?$/i.test(part));
  return [first, last, ...suffixes].filter(Boolean).join(" ");
}

function formatSummary(summary: string): string | null {
  const cleaned = collapseWhitespace(summary.replace("(This is an automatically generated summary.)", ""));
  return cleaned ? truncate(cleaned, BOOK_LIMITS.summary) : null;
}

/** Walks into nested XML nodes; returns undefined if any step is missing. */
function at(node: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>(
    (current, key) => (current && typeof current === "object" ? (current as XmlNode)[key] : undefined),
    node,
  );
}

/** Repeated XML elements parse as arrays, single ones as values; normalise to an array. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Text content of an element, whether or not it has attributes. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object" && "#text" in value) return String((value as XmlNode)["#text"]);
  return "";
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
