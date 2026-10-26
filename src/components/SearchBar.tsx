"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, type RefObject } from "react";

import styles from "./SearchBar.module.css";

/**
 * Search form. Submitting navigates to `/?q=…` on the client, so results are
 * shareable and the back button works, and it still works without JavaScript.
 *
 * The input is part of the static page shell and is never re-mounted, so
 * nothing the user types is lost while the page streams in. The current
 * query is filled in from the URL once it is known.
 */
export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Form action="/" role="search" className={styles.form}>
      <label htmlFor="book-search" className="visually-hidden">
        Search books by title or author
      </label>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        id="book-search"
        name="q"
        type="search"
        placeholder="Search by title or author, e.g. “Austen”"
        autoComplete="off"
        maxLength={200}
        className={styles.input}
      />
      <button type="submit" className={`button button-primary ${styles.button}`}>
        Search
      </button>
      <Suspense fallback={null}>
        <QueryFromUrl inputRef={inputRef} />
      </Suspense>
    </Form>
  );
}

/** Shows the URL's `?q=` in the input, e.g. on page load or after using the back button. */
function QueryFromUrl({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const query = useSearchParams().get("q") ?? "";

  useEffect(() => {
    const input = inputRef.current;
    // Never overwrite what the user is currently typing.
    if (input && document.activeElement !== input) input.value = query;
  }, [inputRef, query]);

  return null;
}
