"use client";
import { Paperclip } from "lucide-react";
import { useRef } from "react";
import { Button } from "@camera-path/ui-kit";
import { CHAT_IMAGE_ACCEPT, CHAT_MAX_IMAGES } from "../constants";

export function ChatImageInput({
  files,
  disabled,
  onAdd,
}: {
  files: File[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        aria-label="Attach images"
        className="sr-only"
        type="file"
        accept={CHAT_IMAGE_ACCEPT}
        multiple
        disabled={disabled}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <Button
        aria-label="Attach images"
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled || files.length >= CHAT_MAX_IMAGES}
        onClick={() => input.current?.click()}
      >
        <Paperclip className="size-3.5" />
      </Button>
    </>
  );
}
