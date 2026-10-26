/**
 * Shelf definitions shared by the server (database, validation) and the
 * client (UI). The shelf `id` is used everywhere: as the database value, the
 * URL slug (`/shelves/reading`) and the key for styling.
 */

export const SHELF_IDS = ["want-to-read", "reading", "finished", "dnf"] as const;

export type ShelfId = (typeof SHELF_IDS)[number];

export interface ShelfInfo {
  id: ShelfId;
  /** Short name, used on tabs and buttons. */
  label: string;
  /** Name used in sentences, e.g. "Back to “Did not finish”". */
  fullLabel: string;
  /** Shown on the shelf page when it has no books. */
  emptyMessage: string;
}

export const SHELVES: readonly ShelfInfo[] = [
  {
    id: "want-to-read",
    label: "Want to read",
    fullLabel: "Want to read",
    emptyMessage: "Nothing queued up yet. Find a book you like and save it for later.",
  },
  {
    id: "reading",
    label: "Reading",
    fullLabel: "Reading",
    emptyMessage: "You are not reading anything right now. Pick something from your list!",
  },
  {
    id: "finished",
    label: "Finished",
    fullLabel: "Finished",
    emptyMessage: "Books you finish will be collected here.",
  },
  {
    id: "dnf",
    label: "DNF",
    fullLabel: "Did not finish",
    emptyMessage: "Books you gave up on end up here. Drag a book into the bin next to your bookcase.",
  },
];

/** The three shelves of the 3D bookcase; "Did not finish" is the bin beside it. */
export const BOOKCASE_SHELVES: readonly ShelfInfo[] = SHELVES.filter((shelf) => shelf.id !== "dnf");

export function isShelfId(value: unknown): value is ShelfId {
  return typeof value === "string" && (SHELF_IDS as readonly string[]).includes(value);
}

export function getShelfInfo(id: ShelfId): ShelfInfo {
  // SHELVES contains every ShelfId, so the lookup cannot fail.
  return SHELVES.find((shelf) => shelf.id === id)!;
}
