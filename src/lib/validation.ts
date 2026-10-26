/**
 * Runtime validation for data that crosses a trust boundary: Server Action
 * arguments (callable with any payload via a direct POST) and URL parameters.
 */

/** Upper bounds for stored text; data from the catalog is trimmed to fit. */
export const BOOK_LIMITS = {
  title: 500,
  author: 500,
  summary: 4000,
} as const;

/** Longest review note that can be saved (the database enforces the same limit). */
export const REVIEW_MAX_LENGTH = 2000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Accepts a positive integer, or a string containing only one. */
export function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "string") {
    if (!/^\d{1,9}$/.test(value.trim())) return null;
    value = Number(value.trim());
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Search params can be repeated (`?q=a&q=b`); we only ever use the first value. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
