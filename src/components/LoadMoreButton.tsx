"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * "Find more books" button. Puts the new result count in the URL (so a
 * reload or shared link shows the same books) without scrolling: the current
 * books stay on screen and the next ones appear below them.
 */
export function LoadMoreButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    const params = new URLSearchParams(window.location.search);
    params.set("count", String(count));
    startTransition(() => router.replace(`?${params}`, { scroll: false }));
  }

  return (
    <button type="button" className="button button-primary" onClick={loadMore} disabled={isPending}>
      {isPending ? "Finding more books…" : "Find more books"}
    </button>
  );
}
