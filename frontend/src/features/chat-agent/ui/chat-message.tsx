import { Bot, UserRound } from "lucide-react";

import type { ChatHistoryMessage } from "@/entities/project";
import { cn } from "@/shared/lib/cn";
import { ChatMarkdown } from "./chat-markdown";

export function ChatMessage({ content, role }: ChatHistoryMessage) {
  const Icon = role === "assistant" ? Bot : UserRound;
  return (
    <div
      className={cn("flex gap-2 px-3 py-2.5", role === "user" && "bg-muted/40")}
    >
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background">
        <Icon className="size-3" />
      </div>
      <div className="min-w-0 flex-1 text-xs leading-5 text-foreground/90">
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
