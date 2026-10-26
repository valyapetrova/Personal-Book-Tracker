import { describe, expect, it } from "vitest";

import { coverUrlFor, formatAuthorName, parseBookRecord, parseSearchFeed } from "@/lib/gutenberg-feeds";

// Trimmed copies of real Project Gutenberg responses.
const SEARCH_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
<id>http://www.gutenberg.org/ebooks/search.opds/?query=austen</id>
<title>Books: austen</title>
<link rel="self" type="application/atom+xml;profile=opds-catalog" href="/ebooks/search.opds/?query=austen"/>
<link rel="next" title="Next Page" type="application/atom+xml;profile=opds-catalog" href="/ebooks/search.opds/?query=austen&amp;start_index=26"/>
<entry>
<id>https://www.gutenberg.org/ebooks/author/search.opds/?query=austen</id>
<title>Authors</title>
<content type="text">2 authors match your search.</content>
</entry>
<entry>
<id>https://www.gutenberg.org/ebooks/1342.opds</id>
<title>Pride and Prejudice</title>
<content type="text">Jane Austen</content>
</entry>
<entry>
<id>https://www.gutenberg.org/ebooks/158.opds</id>
<title>Emma</title>
<content type="text">Jane Austen</content>
</entry>
<entry>
<id>https://www.gutenberg.org/ebooks/1984.opds</id>
<title>1984</title>
</entry>
</feed>`;

const NO_RESULTS_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>http://www.gutenberg.org/ebooks/search.opds/?query=zzqx</id>
<entry><id>https://www.gutenberg.org/ebooks/search.opds/?query=zzqx</id><title>No records found.</title></entry>
</feed>`;

const BOOK_RECORD = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:pgterms="http://www.gutenberg.org/2009/pgterms/" xmlns:marcrel="http://id.loc.gov/vocabulary/relators/">
  <pgterms:ebook rdf:about="ebooks/2600">
    <dcterms:title>War and Peace</dcterms:title>
    <dcterms:creator>
      <pgterms:agent rdf:about="2009/agents/136"><pgterms:name>Tolstoy, Leo, graf</pgterms:name></pgterms:agent>
    </dcterms:creator>
    <marcrel:trl>
      <pgterms:agent rdf:about="2009/agents/2367"><pgterms:name>Maude, Aylmer</pgterms:name></pgterms:agent>
    </marcrel:trl>
    <pgterms:marc520>"War and Peace" is a literary work &amp; epic. (This is an automatically generated summary.)</pgterms:marc520>
    <dcterms:hasFormat>
      <pgterms:file rdf:about="https://www.gutenberg.org/ebooks/2600.txt.utf-8">
        <dcterms:format><rdf:Description><rdf:value rdf:datatype="http://purl.org/dc/terms/IMT">text/plain; charset=utf-8</rdf:value></rdf:Description></dcterms:format>
      </pgterms:file>
    </dcterms:hasFormat>
    <dcterms:hasFormat>
      <pgterms:file rdf:about="https://www.gutenberg.org/cache/epub/2600/pg2600.txt.zip">
        <dcterms:format><rdf:Description><rdf:value>text/plain; charset=us-ascii</rdf:value></rdf:Description></dcterms:format>
      </pgterms:file>
    </dcterms:hasFormat>
    <dcterms:hasFormat>
      <pgterms:file rdf:about="https://www.gutenberg.org/cache/epub/2600/pg2600.cover.medium.jpg">
        <dcterms:format><rdf:Description><rdf:value>image/jpeg</rdf:value></rdf:Description></dcterms:format>
      </pgterms:file>
    </dcterms:hasFormat>
  </pgterms:ebook>
</rdf:RDF>`;

describe("parseSearchFeed", () => {
  it("returns the books in the feed, skipping navigation entries like “Authors”", () => {
    const { books } = parseSearchFeed(SEARCH_FEED);
    expect(books.map((book) => book.id)).toEqual([1342, 158, 1984]);
    expect(books[0]).toEqual({
      id: 1342,
      title: "Pride and Prejudice",
      author: "Jane Austen",
      coverUrl: coverUrlFor(1342),
    });
  });

  it("keeps numeric titles as text and falls back to “Unknown author”", () => {
    const book = parseSearchFeed(SEARCH_FEED).books[2];
    expect(book.title).toBe("1984");
    expect(book.author).toBe("Unknown author");
  });

  it("reports whether there is a next page", () => {
    expect(parseSearchFeed(SEARCH_FEED).hasNextPage).toBe(true);
    expect(parseSearchFeed(NO_RESULTS_FEED)).toEqual({ books: [], hasNextPage: false });
  });

  it("rejects a response that is not a feed", () => {
    expect(() => parseSearchFeed("<html><body>Error</body></html>")).toThrow();
  });
});

describe("parseBookRecord", () => {
  it("reads the details the app needs from an RDF record", () => {
    expect(parseBookRecord(BOOK_RECORD)).toEqual({
      id: 2600,
      title: "War and Peace",
      author: "Leo Tolstoy", // the translator is not listed as an author
      summary: "\"War and Peace\" is a literary work & epic.",
      coverUrl: "https://www.gutenberg.org/cache/epub/2600/pg2600.cover.medium.jpg",
      textUrl: "https://www.gutenberg.org/ebooks/2600.txt.utf-8", // UTF-8, not the zip
    });
  });

  it("returns null when the XML does not describe a book", () => {
    expect(parseBookRecord("<rdf:RDF xmlns:rdf='x'></rdf:RDF>")).toBeNull();
  });
});

describe("formatAuthorName", () => {
  it.each([
    ["Austen, Jane", "Jane Austen"],
    ["Wells, H. G. (Herbert George)", "H. G. Wells"],
    ["Tolstoy, Leo, graf", "Leo Tolstoy"],
    ["King, Martin Luther, Jr.", "Martin Luther King Jr."],
    ["Homer", "Homer"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatAuthorName(input)).toBe(expected);
  });
});
