"use client";
import type { ComponentPropsWithoutRef } from "react";

import styles from "@camera-path/feature-chat-agent/ui/chat-markdown.module.css";

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
