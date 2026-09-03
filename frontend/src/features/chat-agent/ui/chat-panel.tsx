"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import type { Anchor, ChatHistoryMessage } from "@/entities/project";
import { Button, Textarea } from "@/shared/ui";

import { AnchorReferencePicker } from "./anchor-reference-picker";
import { ChatMessage } from "./chat-message";

interface ChatPanelProps {
  anchors: Anchor[];
  error: string | null;
  messages: ChatHistoryMessage[];
  pending: boolean;
  onSend: (message: string) => Promise<void>;
}

export function ChatPanel({ anchors, error, messages, pending, onSend }: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = message.trim();
    if (!text || pending) return;
    setMessage("");
    await onSend(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  function insertAnchor(anchor: Anchor) {
    setMessage((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@${anchor.label} `);
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-background">
      <div className="border-b px-3 py-2.5">
        <h2 className="text-xs font-semibold">Trajectory agent</h2>
        <p className="text-[10px] text-muted-foreground">Build and refine the current path</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="p-4 text-xs leading-5 text-muted-foreground">
            Place at least two anchors, reference them below, and ask for a spline or spiral.
          </div>
        )}
        {messages.map((item, index) => <ChatMessage {...item} key={`${item.role}-${index}`} />)}
        {pending && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Agent is editing the trajectory…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="space-y-2 border-t p-3" onSubmit={submit}>
        <AnchorReferencePicker anchors={anchors} onSelect={insertAnchor} />
        {error && <p className="text-[10px] leading-4 text-destructive">{error}</p>}
        <div className="relative">
          <Textarea
            disabled={pending}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Create a smooth path from @A through @B…"
            value={message}
          />
          <Button
            aria-label="Send message"
            className="absolute bottom-1.5 right-1.5"
            disabled={pending || !message.trim()}
            size="icon"
            type="submit"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
      </form>
    </aside>
  );
}
