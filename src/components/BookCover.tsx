"use client";

import Image from "next/image";
import { useState } from "react";

import type { Book } from "@/lib/types";
import styles from "./BookCover.module.css";

interface BookCoverProps {
  book: Pick<Book, "title" | "coverUrl">;
  className?: string;
}

/**
 * Cover image with a fixed 2:3 book aspect ratio. Books without a cover (or
 * whose cover fails to load) get a typographic placeholder. The image is
 * decorative (`alt=""`) because the title is always shown next to it.
 */
export function BookCover({ book, className }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`${styles.cover} ${className ?? ""}`}>
      {book.coverUrl && !failed ? (
        <Image
          src={book.coverUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 96px, 120px"
          className={styles.image}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.placeholder} aria-hidden="true">
          {book.title}
        </span>
      )}
    </div>
  );
}
