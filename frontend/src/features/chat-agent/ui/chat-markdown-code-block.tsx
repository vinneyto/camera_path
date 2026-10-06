import type { ComponentPropsWithoutRef } from "react";

export function ChatMarkdownCodeBlock({
  children,
}: ComponentPropsWithoutRef<"pre">) {
  return (
    <pre aria-label="Code block" tabIndex={0}>
      {children}
    </pre>
  );
}
