import { getDb } from "@/lib/db";
import type { Book } from "@/lib/types";

/** A real Project Gutenberg book, as the catalog client would return it. */
export const PRIDE_AND_PREJUDICE: Book = {
  id: 1342,
  title: "Pride and Prejudice",
  author: "Jane Austen",
  summary: "A novel published in 1813 that follows Elizabeth Bennet.",
  coverUrl: "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
  textUrl: "https://www.gutenberg.org/ebooks/1342.txt.utf-8",
};

export const FRANKENSTEIN: Book = {
  id: 84,
  title: "Frankenstein; or, The modern Prometheus",
  author: "Mary Wollstonecraft Shelley",
  summary: "A Gothic novel published in 1818.",
  coverUrl: "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg",
  textUrl: "https://www.gutenberg.org/ebooks/84.txt.utf-8",
};

export const MOBY_DICK: Book = {
  id: 2701,
  title: "Moby Dick; Or, The Whale",
  author: "Herman Melville",
  summary: null,
  coverUrl: null,
  textUrl: "https://www.gutenberg.org/ebooks/2701.txt.utf-8",
};

/** Empties every table, so each test starts with an empty library. */
export function resetDatabase(): void {
  getDb().exec("DELETE FROM books; DELETE FROM book_details; DELETE FROM book_texts;");
}
