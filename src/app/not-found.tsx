import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import styles from "./status-page.module.css";

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <EmptyState
        title="Page not found"
        action={
          <Link href="/" className="button button-primary">
            Go to Discover
          </Link>
        }
      >
        We couldn’t find that page or book.
      </EmptyState>
    </div>
  );
}
