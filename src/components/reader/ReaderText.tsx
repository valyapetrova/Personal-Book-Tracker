import type { ReactNode } from "react";

import type { Block } from "@/lib/reader";
import styles from "./ReaderText.module.css";

/** Renders one page of book text. */
export function ReaderText({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case "heading":
        return (
          <h2 key={index} className={styles.heading}>
            {withEmphasis(block.text)}
          </h2>
        );
      case "verse":
        return (
          <p key={index} className={styles.verse}>
            {withEmphasis(block.text)}
          </p>
        );
      default:
        return <p key={index}>{withEmphasis(block.text)}</p>;
    }
  });
}

/** Project Gutenberg marks italics as `_text_`; render those as <em>. */
function withEmphasis(text: string): ReactNode[] {
  return text
    .split(/_([^_\n]+)_/)
    .map((part, index) => (index % 2 === 1 ? <em key={index}>{part}</em> : part));
}
