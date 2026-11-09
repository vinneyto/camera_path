"use client";
import { EditorOnly } from "../ports/editor-only";

import type { useChatComposer } from "@camera-path/feature-chat-agent/model/use-chat-composer";
import { LoaderCircle, Send } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import type { Anchor, ChatHistoryMessage } from "@camera-path/types/project";
import { Button } from "@camera-path/ui-kit";

import { AnchorReferencePicker } from "@camera-path/feature-chat-agent/ui/anchor-reference-picker";
import { AutoGrowingTextarea } from "@camera-path/feature-chat-agent/ui/auto-growing-textarea";
import { ChatMessage } from "@camera-path/feature-chat-agent/ui/chat-message";

import { ChatImageInput } from "./chat-image-input";
import { ChatImageAttachments } from "./chat-image-attachments";

export interface ChatPanelProps {
  selection?: { id: string; name: string } | null;
  anchors: Anchor[];
  error: string | null;
  messages: ChatHistoryMessage[];
  pending: boolean;
  composer: ReturnType<typeof useChatComposer>;
  headerAction?: ReactNode;
}

export function ChatPanel({
  anchors,
  error,
  messages,
  pending,
  composer,
  headerAction,
  selection,
}: ChatPanelProps) {
  const { message, submit, changeMessage, handleKeyDown, insertAnchor } =
    composer;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col bg-background md:border-l">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div>
          <h2 className="text-xs font-semibold">Trajectory agent</h2>
          <p className="text-[10px] text-muted-foreground">
            Build the scene and camera path
          </p>
        </div>
        {headerAction}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="p-4 text-xs leading-5 text-muted-foreground">
            Place at least two anchors, reference them below, and ask for a
            spline or spiral.
          </div>
        )}
        {messages.map((item) => (
          <ChatMessage {...item} key={item.id} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Agent is editing
            the scene…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <EditorOnly>
        <form
          className="shrink-0 space-y-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={submit}
        >
          <fieldset disabled={pending}>
            <AnchorReferencePicker anchors={anchors} onSelect={insertAnchor} />
          </fieldset>
          {selection && (
            <p
              className="truncate rounded border bg-muted/40 px-2 py-1 text-[10px]"
              title={selection.name}
            >
              Selected: {selection.name}
            </p>
          )}
          {composer.files.length > 0 && (
            <ChatImageAttachments
              files={composer.files}
              disabled={pending}
              onRemove={composer.removeFile}
            />
          )}
          {composer.attachmentError && (
            <p className="text-[10px] text-destructive">
              {composer.attachmentError}
            </p>
          )}
          {error && (
            <p className="text-[10px] leading-4 text-destructive">{error}</p>
          )}
          <div className="rounded-xl border border-input bg-transparent shadow-xs focus-within:ring-2 focus-within:ring-ring">
            <AutoGrowingTextarea
              aria-label="Message to trajectory agent"
              className="text-base md:text-xs min-h-10 rounded-none border-0 px-2.5 pb-1 pt-2.5 shadow-none focus-visible:ring-0"
              disabled={pending}
              onChange={(event) => changeMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Create a smooth path from @A through @B…"
              value={message}
            />
            <div className="flex items-center justify-end gap-1.5 px-1.5 pb-1.5">
              <ChatImageInput
                files={composer.files}
                disabled={pending}
                onAdd={composer.addFiles}
              />
              <Button
                aria-label="Send message"
                disabled={pending || !message.trim()}
                size="icon"
                type="submit"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </EditorOnly>
    </aside>
  );
}
