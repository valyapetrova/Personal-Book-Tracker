import Link from "next/link";
import { Suspense } from "react";

import { NavLinks, NavList } from "./NavLinks";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="5" width="6" height="22" rx="1.5" />
            <rect x="12" y="8" width="6" height="19" rx="1.5" />
            <rect x="19.5" y="6.5" width="6" height="21" rx="1.5" transform="rotate(-12 22.5 17)" />
          </svg>
          Shelfie
        </Link>
        <Suspense fallback={<NavList />}>
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}
