"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";

import { removeBookAction, shelveBookAction, type ActionResult } from "@/app/actions";
import { SHELVES, type ShelfId } from "@/lib/shelves";
import styles from "./ShelfPicker.module.css";

interface ShelfPickerProps {
  bookId: number;
  /** Used to label the control for screen readers. */
  bookTitle: string;
  /** The shelf the book is currently on, or null if it is not shelved. */
  shelf: ShelfId | null;
  /** Extra controls shown next to the remove button, e.g. a "Read" link. */
  children?: ReactNode;
  /** Hide the remove button (used where removing would be surprising). */
  allowRemove?: boolean;
}

/**
 * Segmented control for putting a book on one of the three shelves. The UI
 * updates optimistically and rolls back if the server reports an error.
 */
export function ShelfPicker({ bookId, bookTitle, shelf, children, allowRemove = true }: ShelfPickerProps) {
  const [optimisticShelf, setOptimisticShelf] = useOptimistic(shelf);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function update(nextShelf: ShelfId | null, action: () => Promise<ActionResult>) {
    setError(null);
    setConfirmingRemove(false);
    startTransition(async () => {
      setOptimisticShelf(nextShelf);
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className={styles.picker} aria-busy={isPending}>
      <div role="group" aria-label={`Shelf for “${bookTitle}”`} className={styles.options}>
        {SHELVES.map(({ id, label }) => {
          const selected = optimisticShelf === id;
          return (
            <button
              key={id}
              type="button"
              data-shelf={id}
              aria-pressed={selected}
              className={styles.option}
              onClick={() => !selected && update(id, () => shelveBookAction(bookId, id))}
            >
              {selected && (
                <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
              )}
              {label}
            </button>
          );
        })}
      </div>

      {(children || (allowRemove && optimisticShelf)) && (
        <div className={styles.footer}>
          {children}
          {allowRemove && optimisticShelf && (
            <div className={styles.remove}>
              {confirmingRemove ? (
                <>
                  <span className={styles.confirmText}>Remove with its progress?</span>
                  <button
                    type="button"
                    className={`${styles.textButton} ${styles.danger}`}
                    onClick={() => update(null, () => removeBookAction(bookId))}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => setConfirmingRemove(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove from shelves
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
