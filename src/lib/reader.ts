/**
 * Turns a Project Gutenberg plain-text file into readable pages.
 *
 * Gutenberg texts are hard-wrapped at ~70 characters with blank lines between
 * paragraphs. We re-flow prose so it adapts to any screen width, keep line
 * breaks where they matter (poetry, tables of contents) and detect chapter
 * headings so pages can start at a new chapter.
 *
 * Everything here is pure, so it is easy to reason about and test.
 */

export type BlockKind = "heading" | "paragraph" | "verse";

export interface Block {
  kind: BlockKind;
  /** For verse, lines are separated by "\n"; other kinds are a single line. */
  text: string;
}

export type Page = Block[];

/** Approximate amount of text per reader page (about three printed pages). */
export const PAGE_TARGET_CHARS = 6000;
/** A chapter heading starts a new page once the current page has this much text. */
const CHAPTER_BREAK_MIN_CHARS = 1500;
/** A final page shorter than this is merged into the previous one. */
const LAST_PAGE_MIN_CHARS = 300;
/** Paragraphs whose lines are all this short are treated as verse or lists. */
const VERSE_LINE_MAX_CHARS = 55;
const HEADING_MAX_CHARS = 70;

const HEADING_WORDS =
  /^(chapter|book|part|volume|act|scene|letter|stave|canto|preface|introduction|prologue|epilogue|contents|appendix)\b/i;
const ROMAN_NUMERAL = /^[IVXLCDM]+\.?$/;
/** "[Illustration: caption]" markers, which may span several paragraphs. */
const ILLUSTRATION = /\[Illustration[^\]]{0,2000}\]/gi;

const START_MARKER = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK.*$/im;
const END_MARKER = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK.*$/im;

/** Strips the Project Gutenberg licence header and footer, keeping only the book itself. */
export function extractBookBody(raw: string): string {
  let text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const start = START_MARKER.exec(text);
  if (start) text = text.slice(start.index + start[0].length);
  const end = END_MARKER.exec(text);
  if (end) text = text.slice(0, end.index);
  return text.trim();
}

/** Splits book text into typed blocks (headings, prose paragraphs, verse). */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  // The reader shows no images, so drop their placeholders.
  const withoutIllustrations = text.replace(ILLUSTRATION, "");

  for (const chunk of withoutIllustrations.split(/\n[ \t]*\n/)) {
    const lines = chunk.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
    if (lines.length === 0) continue;

    const singleLine = lines.map((line) => line.trim()).join(" ");
    if (isHeading(lines, singleLine)) {
      blocks.push({ kind: "heading", text: singleLine });
    } else if (lines.length > 1 && lines.every((line) => line.trim().length <= VERSE_LINE_MAX_CHARS)) {
      blocks.push({ kind: "verse", text: dedent(lines).join("\n") });
    } else {
      for (const part of splitLongText(singleLine, PAGE_TARGET_CHARS)) {
        blocks.push({ kind: "paragraph", text: part });
      }
    }
  }

  return blocks;
}

/**
 * Groups blocks into pages of roughly `PAGE_TARGET_CHARS`, preferring to
 * start a new page at a chapter heading. Always returns at least one page.
 */
export function paginate(blocks: Block[]): Page[] {
  const pages: Page[] = [];
  let current: Page = [];
  let size = 0;

  for (const block of blocks) {
    const startsChapter = block.kind === "heading" && size >= CHAPTER_BREAK_MIN_CHARS;
    const overflows = size + block.text.length > PAGE_TARGET_CHARS;

    if (current.length > 0 && (startsChapter || overflows)) {
      // Never leave a heading stranded at the bottom of a page.
      const carried = !startsChapter && current.at(-1)?.kind === "heading" ? [current.pop()!] : [];
      if (current.length > 0) pages.push(current);
      current = carried;
      size = carried.reduce((total, b) => total + b.text.length, 0);
    }

    current.push(block);
    size += block.text.length;
  }

  if (pages.length > 0 && size < LAST_PAGE_MIN_CHARS) {
    // Avoid ending on a nearly empty page, e.g. one holding only "THE END".
    pages.at(-1)!.push(...current);
  } else {
    pages.push(current);
  }
  return pages;
}

function isHeading(lines: string[], text: string): boolean {
  if (lines.length > 2 || text.length > HEADING_MAX_CHARS) return false;
  if (HEADING_WORDS.test(text) || ROMAN_NUMERAL.test(text)) return true;
  // Short lines written entirely in capitals, e.g. "THE END".
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

/** Removes the indentation shared by all lines, keeping relative indentation. */
function dedent(lines: string[]): string[] {
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent));
}

/** Splits very long paragraphs at sentence boundaries so no page grows unbounded. */
function splitLongText(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength);
    const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    const cut = sentenceEnd > maxLength / 2 ? sentenceEnd + 1 : window.lastIndexOf(" ") + 1 || maxLength;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
