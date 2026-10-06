import type { ComponentPropsWithoutRef } from "react";

import styles from "./chat-markdown.module.css";

export function ChatMarkdownTable({
  children,
}: ComponentPropsWithoutRef<"table">) {
  return (
    <div
      aria-label="Table"
      className={styles.tableScroll}
      role="region"
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  );
}
