/**
 * Shelf definitions shared by the server (database, validation) and the
 * client (UI). The shelf `id` is used everywhere: as the database value, the
 * URL slug (`/shelves/reading`) and the key for styling.
 */

export const SHELF_IDS = ["want-to-read", "reading", "finished"] as const;

export type ShelfId = (typeof SHELF_IDS)[number];

export interface ShelfInfo {
  id: ShelfId;
  label: string;
  /** Shown on the shelf page when it has no books. */
  emptyMessage: string;
}

export const SHELVES: readonly ShelfInfo[] = [
  {
    id: "want-to-read",
    label: "Want to read",
    emptyMessage: "Nothing queued up yet. Find a book you like and save it for later.",
  },
  {
    id: "reading",
    label: "Reading",
    emptyMessage: "You are not reading anything right now. Pick something from your list!",
  },
  {
    id: "finished",
    label: "Finished",
    emptyMessage: "Books you finish will be collected here.",
  },
];

export function isShelfId(value: unknown): value is ShelfId {
  return typeof value === "string" && (SHELF_IDS as readonly string[]).includes(value);
}

export function getShelfInfo(id: ShelfId): ShelfInfo {
  // SHELVES contains every ShelfId, so the lookup cannot fail.
  return SHELVES.find((shelf) => shelf.id === id)!;
}
