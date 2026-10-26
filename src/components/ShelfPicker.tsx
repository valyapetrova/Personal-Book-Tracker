"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";

import { removeBookAction, setFavoriteAction, shelveBookAction, type ActionResult } from "@/app/actions";
import { getShelfInfo, SHELVES, type ShelfId } from "@/lib/shelves";
import { useReviewPrompt } from "./ReviewPrompt";
import styles from "./ShelfPicker.module.css";

interface ShelfPickerProps {
  bookId: number;
  /** Used to label the controls for screen readers. */
  bookTitle: string;
  /** The shelf the book is currently on, or null if it is not shelved. */
  shelf: ShelfId | null;
  isFavorite: boolean;
  /** Current rating and review, used to pre-fill the review dialog. */
  rating: number | null;
  review: string | null;
  /** Extra controls shown next to the remove button, e.g. a "Read" link. */
  children?: ReactNode;
  /** Hide the remove button (used where removing would be surprising). */
  allowRemove?: boolean;
}

/**
 * A book's library controls: a "Want to read ▾" button whose menu offers the
 * other shelves, a favourite heart, and a remove link. Changes show at once
 * (optimistically) and roll back if the server reports an error. Moving a
 * book to "Finished" asks for a rating and a short review.
 */
export function ShelfPicker({
  bookId,
  bookTitle,
  shelf,
  isFavorite,
  rating,
  review,
  children,
  allowRemove = true,
}: ShelfPickerProps) {
  const [optimisticShelf, setOptimisticShelf] = useOptimistic(shelf);
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const promptReview = useReviewPrompt();

  function run(applyOptimistic: () => void, action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    setConfirmingRemove(false);
    startTransition(async () => {
      applyOptimistic();
      const result = await action();
      if (!result.ok) setError(result.error);
      else onSuccess?.();
    });
  }

  const chooseShelf = (next: ShelfId) =>
    run(
      () => setOptimisticShelf(next),
      () => shelveBookAction(bookId, next),
      // Just finished it: ask what the reader thought.
      next === "finished" ? () => promptReview({ bookId, bookTitle, rating, review, justFinished: true }) : undefined,
    );

  return (
    <div className={styles.picker} aria-busy={isPending}>
      <ShelfMenu bookTitle={bookTitle} shelf={optimisticShelf} onChoose={chooseShelf} />

      <button
        type="button"
        className={styles.favorite}
        aria-pressed={optimisticFavorite}
        onClick={() =>
          run(
            () => setOptimisticFavorite(!optimisticFavorite),
            () => setFavoriteAction(bookId, !optimisticFavorite),
          )
        }
      >
        <svg className={styles.heart} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
        </svg>
        {optimisticFavorite ? "In favorites" : "Add to favorites"}
      </button>

      {(children || (allowRemove && optimisticShelf)) && (
        <div className={styles.footer}>
          {children}
          {allowRemove && optimisticShelf && (
            <div className={styles.remove}>
              {confirmingRemove ? (
                <>
                  <span className={styles.confirmText}>
                    {optimisticFavorite ? "Take off the shelves?" : "Remove with its progress?"}
                  </span>
                  <button
                    type="button"
                    className={`${styles.textButton} ${styles.danger}`}
                    onClick={() => run(() => setOptimisticShelf(null), () => removeBookAction(bookId))}
                  >
                    Remove
                  </button>
                  <button type="button" className={styles.textButton} onClick={() => setConfirmingRemove(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className={styles.textButton} onClick={() => setConfirmingRemove(true)}>
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

interface ShelfMenuProps {
  bookTitle: string;
  shelf: ShelfId | null;
  onChoose(shelf: ShelfId): void;
}

/**
 * Split button. Unshelved books show "Want to read" (one click adds them);
 * shelved books show their shelf. The arrow opens a menu of all shelves.
 */
function ShelfMenu({ bookTitle, shelf, onChoose }: ShelfMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens: to the current shelf, or the first item.
  useEffect(() => {
    if (!open) return;
    const items = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
    const checked = rootRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]");
    (checked ?? items?.[0])?.focus();
  }, [open]);

  function choose(next: ShelfId) {
    setOpen(false);
    toggleRef.current?.focus();
    if (next !== shelf) onChoose(next);
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    }
  }

  const current = shelf ? getShelfInfo(shelf) : null;

  return (
    <div ref={rootRef} className={styles.split} data-shelf={shelf ?? undefined}>
      <button
        type="button"
        className={`${styles.main} ${current ? styles.mainShelved : ""}`}
        // An unshelved book goes straight onto "Want to read"; otherwise show the choices.
        onClick={() => (current ? setOpen(!open) : onChoose("want-to-read"))}
        aria-label={current ? `“${bookTitle}” is on ${current.fullLabel}. Change shelf` : `Add “${bookTitle}” to Want to read`}
      >
        {current && (
          <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        )}
        {current ? current.fullLabel : "Want to read"}
      </button>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Choose a shelf for “${bookTitle}”`}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <ul id={menuId} role="menu" aria-label="Shelves" className={styles.menu} onKeyDown={onMenuKeyDown}>
          {SHELVES.map(({ id, fullLabel }) => (
            <li key={id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={shelf === id}
                data-shelf={id}
                className={styles.menuItem}
                onClick={() => choose(id)}
              >
                <span className={styles.swatch} aria-hidden="true" />
                {fullLabel}
                {shelf === id && (
                  <svg className={styles.menuCheck} viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
