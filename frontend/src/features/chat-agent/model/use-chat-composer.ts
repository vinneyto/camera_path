"use client";

import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import type { Anchor } from "@/entities/project";

interface ChatComposerOptions {
  pending: boolean;
  onSend: (
    id: string,
    message: string,
    onAccepted: () => void,
  ) => Promise<void>;
}

// Lives above the responsive panel so its draft and retry ID survive closing or resizing.
export function useChatComposer({ pending, onSend }: ChatComposerOptions) {
  const [message, setMessage] = useState("");
  const draftIdRef = useRef<string | null>(null);
  const submittedTextRef = useRef<string | null>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = message.trim();
    if (!text || pending) return;
    const submittedMessage = message;
    const messageId = draftIdRef.current ?? crypto.randomUUID();
    draftIdRef.current = messageId;
    submittedTextRef.current = text;
    void onSend(messageId, text, () => {
      draftIdRef.current = null;
      submittedTextRef.current = null;
      setMessage((current) => (current === submittedMessage ? "" : current));
    });
  }

  function changeMessage(nextMessage: string) {
    if (
      submittedTextRef.current !== null &&
      nextMessage.trim() !== submittedTextRef.current
    ) {
      draftIdRef.current = null;
      submittedTextRef.current = null;
    }
    setMessage(nextMessage);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submit();
    }
  }

  function insertAnchor(anchor: Anchor) {
    setMessage(
      (current) =>
        `${current}${current && !current.endsWith(" ") ? " " : ""}@${anchor.label} `,
    );
  }

  return { message, submit, changeMessage, handleKeyDown, insertAnchor };
}
