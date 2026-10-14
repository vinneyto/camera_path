"use client";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { ChatMarkdownCodeBlock } from "@camera-path/feature-chat-agent/ui/chat-markdown-code-block";
import { ChatMarkdownLink } from "@camera-path/feature-chat-agent/ui/chat-markdown-link";
import { ChatMarkdownTable } from "@camera-path/feature-chat-agent/ui/chat-markdown-table";
import styles from "@camera-path/feature-chat-agent/ui/chat-markdown.module.css";

const components: Components = {
  a: ChatMarkdownLink,
  pre: ChatMarkdownCodeBlock,
  table: ChatMarkdownTable,
};
const remarkPlugins = [remarkGfm];

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className={styles.markdown}>
      <Markdown components={components} remarkPlugins={remarkPlugins} skipHtml>
        {content}
      </Markdown>
    </div>
  );
}
