"use client";
import { Bot, UserRound } from "lucide-react";

import { ChatMarkdown } from "@camera-path/feature-chat-agent/ui/chat-markdown";
import type { ChatHistoryMessage } from "@camera-path/types/project";
import { cn } from "@camera-path/ui-kit/lib/cn";
import type { ChatAttachment } from "@camera-path/types/api";
import { ChatImage } from "./chat-image";

export function ChatMessage({
  content,
  role,
  selected_object,
  attachments,
  onContinue,
  disabled,
}: Pick<ChatHistoryMessage, "content" | "role" | "id"> &
  Partial<Pick<ChatHistoryMessage, "selected_object" | "attachments">> & {
    onContinue?: (image: ChatAttachment, anchorId?: string | null) => void;
    disabled?: boolean;
  }) {
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
          <ChatImage
            key={image.id}
            image={image}
            disabled={disabled}
            onContinue={onContinue ? () => onContinue(image) : undefined}
          />
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
