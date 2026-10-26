import { getImageProps } from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";

import { Bookcase } from "@/components/bookcase/Bookcase";
import type { BookcaseBook } from "@/components/bookcase/bookcase-scene";
import { listShelf } from "@/lib/library";
import { SHELF_IDS } from "@/lib/shelves";
import styles from "./page.module.css";

/** `/shelves`: every shelved book in an animated 3D bookcase. */
export default function BookcasePage() {
  return (
    <Suspense fallback={<div className={styles.placeholder} />}>
      <BookcaseLoader />
    </Suspense>
  );
}

async function BookcaseLoader() {
  await connection();
  const books: BookcaseBook[] = SHELF_IDS.flatMap((shelf) => listShelf(shelf)).map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    shelf: book.shelf,
    coverSrc: book.coverUrl ? sameOriginCover(book.coverUrl) : null,
    rating: book.rating,
    review: book.review,
  }));
  return <Bookcase books={books} />;
}

/**
 * WebGL can only use images from our own origin, so covers are loaded
 * through Next.js's image optimizer, which also resizes them.
 */
function sameOriginCover(url: string): string {
  return getImageProps({ src: url, alt: "", width: 256, height: 384 }).props.src;
}
