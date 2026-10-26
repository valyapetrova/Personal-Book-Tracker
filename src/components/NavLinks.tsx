"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import styles from "./SiteHeader.module.css";

const LINKS = [
  { href: "/", label: "Discover", segment: null },
  { href: "/shelves", label: "My shelves", segment: "shelves" },
] as const;

/**
 * Main navigation; highlights the section the user is currently in. Reading
 * the URL makes this dynamic, so render it inside `<Suspense>` with
 * `<NavList />` as the fallback.
 */
export function NavLinks() {
  return <NavList activeSegment={useSelectedLayoutSegment()} />;
}

/** The navigation markup. Without `activeSegment`, no link is highlighted. */
export function NavList({ activeSegment }: { activeSegment?: string | null }) {
  return (
    <nav aria-label="Main">
      <ul className={styles.navList}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.navLink}
              aria-current={activeSegment === link.segment ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
