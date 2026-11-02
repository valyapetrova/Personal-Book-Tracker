"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import styles from "./SiteHeader.module.css";

/** `sections`: the first URL segments each link is highlighted for ("" is the home page). */
const LINKS: { href: string; label: string; sections: string[] }[] = [
  { href: "/", label: "My shelves", sections: ["", "shelves"] },
  { href: "/discover", label: "Discover", sections: ["discover"] },
];

/**
 * Main navigation; highlights the section the user is currently in. Reading
 * the URL makes this dynamic, so render it inside `<Suspense>` with
 * `<NavList />` as the fallback.
 */
export function NavLinks() {
  // Route groups such as "(library)" are not part of the URL, so skip them.
  const section = useSelectedLayoutSegments().find((segment) => !segment.startsWith("(")) ?? "";
  return <NavList activeSection={section} />;
}

/** The navigation markup. Without `activeSection`, no link is highlighted. */
export function NavList({ activeSection }: { activeSection?: string }) {
  return (
    <nav aria-label="Main">
      <ul className={styles.navList}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.navLink}
              aria-current={activeSection !== undefined && link.sections.includes(activeSection) ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
