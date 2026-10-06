import type { ComponentPropsWithoutRef } from "react";

export function ChatMarkdownLink({
  children,
  href,
  title,
}: ComponentPropsWithoutRef<"a">) {
  if (!href) return <span>{children}</span>;
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target={href.startsWith("#") ? undefined : "_blank"}
      title={title}
    >
      {children}
    </a>
  );
}
