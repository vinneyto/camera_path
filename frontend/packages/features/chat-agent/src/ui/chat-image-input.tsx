"use client";
import { Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@camera-path/ui-kit";
import { CHAT_IMAGE_ACCEPT, CHAT_MAX_IMAGES } from "../constants";

export function ChatImageInput({
  files,
  disabled,
  onAdd,
  onRemove,
}: {
  files: File[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
      {files.map((file, index) => (
        <span
          key={index}
          className="flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
        >
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onRemove(index)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
