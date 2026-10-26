import Form from "next/form";

import styles from "./PageJump.module.css";

interface PageJumpProps {
  bookId: number;
  page: number;
  pageCount: number;
}

/** Small form for jumping straight to a page number. */
export function PageJump({ bookId, page, pageCount }: PageJumpProps) {
  return (
    <Form action={`/read/${bookId}`} className={styles.form}>
      <label htmlFor="page-jump">Go to page</label>
      <input
        // Remount when the page changes so the field shows the current page.
        key={page}
        id="page-jump"
        name="page"
        type="number"
        inputMode="numeric"
        min={1}
        max={pageCount}
        defaultValue={page}
        required
        className={styles.input}
      />
      <button type="submit" className="button button-small">
        Go
      </button>
    </Form>
  );
}
