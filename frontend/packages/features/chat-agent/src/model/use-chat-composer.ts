"use client";
import type { Anchor } from "@camera-path/types/project";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";

import { CHAT_MAX_IMAGES, CHAT_MAX_IMAGE_BYTES } from "../constants";

interface ChatComposerOptions {
  pending: boolean;
  selectedObjectId?: string | null;
  onSend: (
    id: string,
    message: string,
    onAccepted: () => void,
    files?: File[],
  ) => Promise<void>;
}

// Lives above the responsive panel so its draft and retry ID survive closing or resizing.
export function useChatComposer({
  pending,
  onSend,
  selectedObjectId = null,
}: ChatComposerOptions) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const draftSelectionRef = useRef<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const submittedTextRef = useRef<string | null>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = message.trim();
    if (!text || pending) return;
    const submittedMessage = message;
    const submittedFiles = files;
    if (draftSelectionRef.current !== selectedObjectId)
      draftIdRef.current = null;
    draftSelectionRef.current = selectedObjectId;
    const messageId = draftIdRef.current ?? crypto.randomUUID();
    draftIdRef.current = messageId;
    submittedTextRef.current = text;
    void onSend(
      messageId,
      text,
      () => {
        draftIdRef.current = null;
        submittedTextRef.current = null;
        setMessage((current) => (current === submittedMessage ? "" : current));
        setFiles((current) =>
          current.filter((file) => !submittedFiles.includes(file)),
        );
      },
      submittedFiles,
    );
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

  function addFiles(next: File[]) {
    if (
      files.length + next.length > CHAT_MAX_IMAGES ||
      next.some(
        (file) =>
          file.size > CHAT_MAX_IMAGE_BYTES ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type),
      )
    ) {
      setAttachmentError(
        "Attach up to 8 PNG, JPEG or WebP images, at most 20 MB each.",
      );
      return;
    }
    draftIdRef.current = null;
    setAttachmentError(null);
    setFiles((current) => [...current, ...next]);
  }
  function removeFile(index: number) {
    draftIdRef.current = null;
    setFiles((current) => current.filter((_, i) => i !== index));
    setAttachmentError(null);
  }
  return {
    message,
    submit,
    changeMessage,
    handleKeyDown,
    insertAnchor,
    files,
    addFiles,
    removeFile,
    attachmentError,
  };
}
