import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** Optional call to action, e.g. a link to another page. */
  action?: ReactNode;
  /** Use "alert" for errors so screen readers announce them. */
  role?: "status" | "alert";
}

/** Friendly message for empty lists and recoverable errors. */
export function EmptyState({ title, children, action, role = "status" }: EmptyStateProps) {
  return (
    <div className={styles.empty} role={role}>
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.message}>{children}</div>}
      {action}
    </div>
  );
}
