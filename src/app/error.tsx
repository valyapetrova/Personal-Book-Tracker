"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

import { EmptyState } from "@/components/EmptyState";
import styles from "./status-page.module.css";

/** Fallback for unexpected errors anywhere below the root layout. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`container ${styles.page}`}>
      <EmptyState
        role="alert"
        title="Something went wrong"
        action={
          <div className={styles.actions}>
            <button type="button" className="button button-primary" onClick={() => retry()}>
              Try again
            </button>
            <Link href="/" className="button">
              Go to Discover
            </Link>
          </div>
        }
      >
        Your shelves are safe. Please try again in a moment.
      </EmptyState>
    </div>
  );
}
