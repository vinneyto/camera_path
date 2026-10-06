import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { ChatMarkdownCodeBlock } from "./chat-markdown-code-block";
import { ChatMarkdownLink } from "./chat-markdown-link";
import { ChatMarkdownTable } from "./chat-markdown-table";
import styles from "./chat-markdown.module.css";

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
