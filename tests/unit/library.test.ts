import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import * as library from "@/lib/library";
import { FRANKENSTEIN, MOBY_DICK, PRIDE_AND_PREJUDICE, resetDatabase } from "./support/fixtures";

beforeEach(resetDatabase);

describe("database", () => {
  it("runs every migration and uses crash-safe settings", () => {
    const db = getDb();
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(5);
    expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
    expect((db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous).toBe(2); // FULL
  });

  it.each([
    ["an unknown shelf", "INSERT INTO books (id, title, author, shelf) VALUES (1, 'x', 'y', 'bogus')"],
    ["a book that is neither shelved nor a favourite", "INSERT INTO books (id, title, author) VALUES (1, 'x', 'y')"],
    ["a rating above 5", "INSERT INTO books (id, title, author, shelf, rating) VALUES (1, 'x', 'y', 'finished', 6)"],
    ["a rating of 0", "INSERT INTO books (id, title, author, shelf, rating) VALUES (1, 'x', 'y', 'finished', 0)"],
    ["a negative page", "INSERT INTO books (id, title, author, shelf, last_page) VALUES (1, 'x', 'y', 'reading', -1)"],
    ["text in a number column", "INSERT INTO books (id, title, author, shelf, last_page) VALUES (1, 'x', 'y', 'reading', 'ten')"],
    ["an empty title", "INSERT INTO books (id, title, author, shelf) VALUES (1, '', 'y', 'reading')"],
  ])("rejects %s, even if application code had a bug", (_, sql) => {
    expect(() => getDb().prepare(sql).run()).toThrow();
  });
});

describe("shelves", () => {
  it("adds a book to a shelf and lists it there", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "want-to-read");

    expect(library.listShelf("want-to-read")).toMatchObject([
      { id: 1342, title: "Pride and Prejudice", shelf: "want-to-read", isFavorite: false, lastPage: 0, rating: null },
    ]);
    expect(library.listShelf("reading")).toEqual([]);
  });

  it("moves a book between shelves and keeps its reading progress", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    library.saveReadingProgress(1342, 12, 148);

    expect(library.moveBook(1342, "finished")).toBe(true);
    expect(library.getLibraryBook(1342)).toMatchObject({ shelf: "finished", lastPage: 12, pageCount: 148 });
  });

  it("reports when moving a book that is not in the library", () => {
    expect(library.moveBook(999, "reading")).toBe(false);
  });

  it("lists the most recently changed books first", async () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    await new Promise((resolve) => setTimeout(resolve, 5));
    library.shelveBook(FRANKENSTEIN, "reading");

    expect(library.listShelf("reading").map((book) => book.id)).toEqual([84, 1342]);
  });

  it("counts books per shelf and favourites", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    library.shelveBook(FRANKENSTEIN, "finished");
    library.addFavorite(MOBY_DICK);

    expect(library.countLibrary()).toEqual({ "want-to-read": 0, reading: 1, finished: 1, dnf: 0, favorites: 1 });
  });

  it("removes a book together with its progress", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    library.removeBook(1342);

    expect(library.getLibraryBook(1342)).toBeNull();
  });

  it("reports the shelf, favourite and rating state of several books at once", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "finished");
    library.saveReview(1342, 4, "Lovely");
    library.addFavorite(FRANKENSTEIN);

    const statuses = library.getStatusesFor([1342, 84, 2701]);
    expect(statuses.get(1342)).toEqual({ shelf: "finished", isFavorite: false, rating: 4, review: "Lovely" });
    expect(statuses.get(84)).toEqual({ shelf: null, isFavorite: true, rating: null, review: null });
    expect(statuses.has(2701)).toBe(false);
    expect(library.getStatusesFor([]).size).toBe(0);
  });
});

describe("favourites", () => {
  it("can favourite a book that is on no shelf", () => {
    library.addFavorite(MOBY_DICK);

    expect(library.listFavorites()).toMatchObject([{ id: 2701, shelf: null, isFavorite: true }]);
  });

  it("keeps a shelved book when it is un-favourited", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    expect(library.favoriteLibraryBook(1342)).toBe(true);
    library.removeFavorite(1342);

    expect(library.getLibraryBook(1342)).toMatchObject({ shelf: "reading", isFavorite: false });
  });

  it("drops a favourite-only book from the library when it is un-favourited", () => {
    library.addFavorite(MOBY_DICK);
    library.removeFavorite(2701);

    expect(library.getLibraryBook(2701)).toBeNull();
  });

  it("keeps a favourite in the library when it is taken off the shelves", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    library.saveReadingProgress(1342, 30, 148);
    library.favoriteLibraryBook(1342);
    library.removeBook(1342);

    expect(library.getLibraryBook(1342)).toMatchObject({ shelf: null, isFavorite: true, lastPage: 30 });
  });
});

describe("starting to read", () => {
  it("puts a book that is not in the library onto Reading", () => {
    expect(library.startReading(PRIDE_AND_PREJUDICE)).toBe(true);
    expect(library.getLibraryBook(1342)?.shelf).toBe("reading");
  });

  it("puts a favourite that is on no shelf onto Reading, keeping it a favourite", () => {
    library.addFavorite(MOBY_DICK);
    library.startReading(MOBY_DICK);

    expect(library.getLibraryBook(2701)).toMatchObject({ shelf: "reading", isFavorite: true });
  });

  it.each(["want-to-read", "finished", "dnf"] as const)("leaves a book on %s where it is", (shelf) => {
    library.shelveBook(PRIDE_AND_PREJUDICE, shelf);

    expect(library.startReading(PRIDE_AND_PREJUDICE)).toBe(false);
    expect(library.getLibraryBook(1342)?.shelf).toBe(shelf);
  });
});

describe("ratings and reviews", () => {
  it("saves, updates and clears a rating with its review", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "finished");

    expect(library.saveReview(1342, 5, "A favourite.")).toBe(true);
    expect(library.getLibraryBook(1342)).toMatchObject({ rating: 5, review: "A favourite." });

    library.saveReview(1342, 3, null);
    expect(library.getLibraryBook(1342)).toMatchObject({ rating: 3, review: null });

    library.saveReview(1342, null, null);
    expect(library.getLibraryBook(1342)).toMatchObject({ rating: null, review: null });
  });

  it("cannot rate a book that is not in the library", () => {
    expect(library.saveReview(999, 4, null)).toBe(false);
  });
});

describe("reading progress", () => {
  it("is saved for library books and ignored for others", () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");
    library.saveReadingProgress(1342, 7, 148);
    library.saveReadingProgress(999, 7, 148);

    expect(library.getLibraryBook(1342)).toMatchObject({ lastPage: 7, pageCount: 148 });
    expect(library.getLibraryBook(999)).toBeNull();
  });
});
