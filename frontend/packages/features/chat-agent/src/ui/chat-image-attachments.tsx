"use client";
import { X } from "lucide-react";

export function ChatImageAttachments({
  files,
  disabled,
  onRemove,
}: {
  files: File[];
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
