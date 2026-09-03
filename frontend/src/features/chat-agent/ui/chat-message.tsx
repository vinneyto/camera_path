import { Bot, UserRound } from "lucide-react";

import type { ChatHistoryMessage } from "@/entities/project/model/types";
import { cn } from "@/shared/lib/cn";

export function ChatMessage({ content, role }: ChatHistoryMessage) {
  const Icon = role === "assistant" ? Bot : UserRound;
  return (
    <div className={cn("flex gap-2 px-3 py-2.5", role === "user" && "bg-muted/40")}>
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background">
        <Icon className="size-3" />
      </div>
      <p className="whitespace-pre-wrap text-xs leading-5 text-foreground/90">{content}</p>
    </div>
  );
}
