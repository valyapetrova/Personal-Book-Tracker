import { describe, expect, it } from "vitest";

import { extractBookBody, PAGE_TARGET_CHARS, paginate, toBlocks, type Block } from "@/lib/reader";

const prose = (length: number, word = "word") => `${`${word} `.repeat(Math.ceil(length / (word.length + 1)))}`.slice(0, length);

describe("extractBookBody", () => {
  it("keeps only the text between the Project Gutenberg start and end markers", () => {
    const raw = [
      "The Project Gutenberg eBook of Test",
      "*** START OF THE PROJECT GUTENBERG EBOOK TEST ***",
      "CHAPTER I.",
      "",
      "It was a dark night.",
      "*** END OF THE PROJECT GUTENBERG EBOOK TEST ***",
      "Licence text that must not appear.",
    ].join("\r\n");

    expect(extractBookBody(raw)).toBe("CHAPTER I.\n\nIt was a dark night.");
  });

  it("returns the whole (trimmed) text when there are no markers", () => {
    expect(extractBookBody("﻿  Just a book.  ")).toBe("Just a book.");
  });
});

describe("toBlocks", () => {
  it("re-flows hard-wrapped prose into a single paragraph", () => {
    const blocks = toBlocks("It is a truth universally acknowledged, that a single man in\npossession of a good fortune, must be in want of a wife.");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
      },
    ]);
  });

  it("recognises chapter headings, roman numerals and all-caps titles", () => {
    const kinds = toBlocks("CHAPTER I.\n\nXII.\n\nTHE END\n\nChapter Two").map((block) => block.kind);
    expect(kinds).toEqual(["heading", "heading", "heading", "heading"]);
  });

  it("keeps line breaks in poetry and tables of contents, removing shared indentation", () => {
    const [block] = toBlocks("    Tyger Tyger, burning bright,\n    In the forests of the night;\n      What immortal hand or eye");
    expect(block).toEqual({
      kind: "verse",
      text: "Tyger Tyger, burning bright,\nIn the forests of the night;\n  What immortal hand or eye",
    });
  });

  it("drops [Illustration] placeholders, even when they span several paragraphs", () => {
    const blocks = toBlocks("[Illustration: A\n\nlong caption]\n\nThe story begins.\n\n[Illustration]");
    expect(blocks).toEqual([{ kind: "paragraph", text: "The story begins." }]);
  });

  it("splits a huge paragraph at sentence boundaries", () => {
    const blocks = toBlocks("This is one sentence. ".repeat(1000));
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block.text.length).toBeLessThanOrEqual(PAGE_TARGET_CHARS);
    expect(blocks[0].text.endsWith(".")).toBe(true);
  });
});

describe("paginate", () => {
  const paragraph = (length: number): Block => ({ kind: "paragraph", text: prose(length) });
  const heading = (text: string): Block => ({ kind: "heading", text });

  it("always returns at least one (possibly empty) page", () => {
    expect(paginate([])).toEqual([[]]);
  });

  it("starts a new page when the current one is full", () => {
    const pages = paginate([paragraph(4000), paragraph(4000), paragraph(4000)]);
    expect(pages).toHaveLength(3);
  });

  it("starts a chapter on a new page once the page has enough text", () => {
    const pages = paginate([paragraph(2000), heading("CHAPTER II."), paragraph(500)]);
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toEqual(heading("CHAPTER II."));
  });

  it("never leaves a heading stranded at the bottom of a page", () => {
    const pages = paginate([paragraph(1000), heading("CONTENTS"), paragraph(5500)]);
    for (const page of pages.slice(0, -1)) expect(page.at(-1)?.kind).not.toBe("heading");
  });

  it("merges a tiny final page (e.g. just “THE END”) into the previous one", () => {
    const pages = paginate([paragraph(5000), paragraph(2000), heading("THE END")]);
    expect(pages.at(-1)?.at(-1)).toEqual(heading("THE END"));
    expect(pages.at(-1)?.length).toBeGreaterThan(1);
  });
});
