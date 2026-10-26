"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-renders the current page on the server, e.g. after a failed request. */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button button-primary"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {isPending ? "Retrying…" : label}
    </button>
  );
}
