import { beforeEach, describe, expect, it, vi } from "vitest";

import * as library from "@/lib/library";
import type { Book } from "@/lib/types";
import { FRANKENSTEIN, PRIDE_AND_PREJUDICE, resetDatabase } from "./support/fixtures";

/**
 * Server Actions can be called with any payload by a direct POST request,
 * so these tests check that every argument is validated and that book
 * details come from the catalog, never from the caller.
 */

const catalog = vi.hoisted(() => new Map<number, Book>());

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/gutenberg", () => ({
  getBookDetails: vi.fn(async (id: number) => catalog.get(id) ?? null),
}));

const { refresh } = await import("next/cache");
const actions = await import("@/app/actions");

beforeEach(() => {
  resetDatabase();
  vi.clearAllMocks();
  catalog.clear();
  catalog.set(PRIDE_AND_PREJUDICE.id, PRIDE_AND_PREJUDICE);
  catalog.set(FRANKENSTEIN.id, FRANKENSTEIN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("shelveBookAction", () => {
  it("adds a new book using details from the catalog, then refreshes the page", async () => {
    await expect(actions.shelveBookAction(1342, "reading")).resolves.toEqual({ ok: true });

    expect(library.getLibraryBook(1342)).toMatchObject({ title: "Pride and Prejudice", shelf: "reading" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("moves a book that is already in the library", async () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "want-to-read");

    await actions.shelveBookAction(1342, "dnf");
    expect(library.getLibraryBook(1342)?.shelf).toBe("dnf");
  });

  it.each([
    ["an unknown shelf", 1342, "bogus"],
    ["a negative id", -1, "reading"],
    ["an id smuggling SQL", "1; DROP TABLE books", "reading"],
  ])("rejects %s without changing anything", async (_, id, shelf) => {
    const result = await actions.shelveBookAction(id as number, shelf as "reading");

    expect(result.ok).toBe(false);
    expect(library.countLibrary()).toMatchObject({ "want-to-read": 0, reading: 0, finished: 0, dnf: 0 });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects a book that does not exist on Project Gutenberg", async () => {
    await expect(actions.shelveBookAction(424242, "reading")).resolves.toEqual({
      ok: false,
      error: "This book does not exist on Project Gutenberg.",
    });
  });

  it("returns a friendly message (not the raw error) when something unexpected fails", async () => {
    catalog.clear();
    const { getBookDetails } = await import("@/lib/gutenberg");
    vi.mocked(getBookDetails).mockRejectedValueOnce(new Error("socket hang up"));

    await expect(actions.shelveBookAction(1342, "reading")).resolves.toEqual({
      ok: false,
      error: "Could not update your shelves. Please try again.",
    });
  });
});

describe("removeBookAction", () => {
  it("removes a book from the shelves", async () => {
    library.shelveBook(PRIDE_AND_PREJUDICE, "reading");

    await expect(actions.removeBookAction(1342)).resolves.toEqual({ ok: true });
    expect(library.getLibraryBook(1342)).toBeNull();
  });

  it("rejects an invalid id", async () => {
    expect((await actions.removeBookAction(0)).ok).toBe(false);
  });
});

describe("setFavoriteAction", () => {
  it("favourites a book that is not in the library yet, and un-favourites it", async () => {
    await actions.setFavoriteAction(84, true);
    expect(library.getLibraryBook(84)).toMatchObject({ isFavorite: true, shelf: null });

    await actions.setFavoriteAction(84, false);
    expect(library.getLibraryBook(84)).toBeNull();
  });

  it("rejects a value that is not true or false", async () => {
    expect((await actions.setFavoriteAction(84, "yes" as unknown as boolean)).ok).toBe(false);
  });
});

describe("saveReviewAction", () => {
  beforeEach(() => library.shelveBook(PRIDE_AND_PREJUDICE, "finished"));

  it("saves stars and a trimmed note", async () => {
    await expect(actions.saveReviewAction(1342, 4, "  Witty and warm.  ")).resolves.toEqual({ ok: true });
    expect(library.getLibraryBook(1342)).toMatchObject({ rating: 4, review: "Witty and warm." });
  });

  it("stores an empty note as no note", async () => {
    await actions.saveReviewAction(1342, 5, "   ");
    expect(library.getLibraryBook(1342)?.review).toBeNull();
  });

  it("clears the rating and note when the rating is removed", async () => {
    await actions.saveReviewAction(1342, 4, "Witty");
    await actions.saveReviewAction(1342, null, "");
    expect(library.getLibraryBook(1342)).toMatchObject({ rating: null, review: null });
  });

  it.each([0, 6, 2.5, Number.NaN])("rejects a rating of %s", async (rating) => {
    expect((await actions.saveReviewAction(1342, rating, "")).ok).toBe(false);
    expect(library.getLibraryBook(1342)?.rating).toBeNull();
  });

  it("rejects a note over 2,000 characters", async () => {
    const result = await actions.saveReviewAction(1342, 3, "x".repeat(2001));
    expect(result).toEqual({ ok: false, error: "Keep the review under 2000 characters." });
  });

  it("rejects rating a book that is not in the library", async () => {
    expect((await actions.saveReviewAction(84, 3, "")).ok).toBe(false);
  });
});

describe("startReadingAction", () => {
  it("puts an unshelved book onto Reading", async () => {
    await actions.startReadingAction(1342);
    expect(library.getLibraryBook(1342)?.shelf).toBe("reading");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does nothing (and does not refresh) for a book already on a shelf", async () => {
    library.shelveBook(FRANKENSTEIN, "finished");

    await actions.startReadingAction(84);
    expect(library.getLibraryBook(84)?.shelf).toBe("finished");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("saveProgressAction", () => {
  beforeEach(() => library.shelveBook(PRIDE_AND_PREJUDICE, "reading"));

  it("saves the page being read", async () => {
    await actions.saveProgressAction(1342, 20, 148);
    expect(library.getLibraryBook(1342)).toMatchObject({ lastPage: 20, pageCount: 148 });
  });

  it.each([
    ["a page past the end", 149, 148],
    ["page 0", 0, 148],
    ["a missing page count", 3, 0],
  ])("rejects %s", async (_, page, pageCount) => {
    expect((await actions.saveProgressAction(1342, page, pageCount)).ok).toBe(false);
  });
});
