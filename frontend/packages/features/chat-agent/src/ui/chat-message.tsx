"use client";
import { Bot, UserRound } from "lucide-react";

import { ChatMarkdown } from "@camera-path/feature-chat-agent/ui/chat-markdown";
import type { ChatHistoryMessage } from "@camera-path/types/project";
import { cn } from "@camera-path/ui-kit/lib/cn";

export function ChatMessage({
  content,
  role,
  selected_object,
  attachments,
}: Pick<ChatHistoryMessage, "content" | "role" | "id"> &
  Partial<Pick<ChatHistoryMessage, "selected_object" | "attachments">>) {
  const Icon = role === "assistant" ? Bot : UserRound;
  return (
    <div
      className={cn("flex gap-2 px-3 py-2.5", role === "user" && "bg-muted/40")}
    >
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background">
        <Icon className="size-3" />
      </div>
      <div className="min-w-0 flex-1 text-xs leading-5 text-foreground/90">
        {selected_object && (
          <p className="mb-1 text-[10px] text-muted-foreground">
            Selected: {selected_object.name}
          </p>
        )}
        {attachments?.map((image) => (
          <a
            key={image.id}
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="mb-1 block truncate text-[10px] underline"
          >
            {image.name}
          </a>
        ))}
        {role === "assistant" ? (
          <ChatMarkdown content={content} />
        ) : (
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}
