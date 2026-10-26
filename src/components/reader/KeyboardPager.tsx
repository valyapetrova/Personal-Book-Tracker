"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface KeyboardPagerProps {
  previousHref: string | null;
  nextHref: string | null;
}

/** Turns pages with the ← and → arrow keys, unless the user is typing. */
export function KeyboardPager({ previousHref, nextHref }: KeyboardPagerProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) {
        return;
      }
      const href = event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : null;
      if (href) {
        event.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, previousHref, nextHref]);

  return null;
}
