"use client";

import { Plus, X } from "lucide-react";

import type { DepthOfFieldEffect } from "@/entities/project";
import { Button } from "@/shared/ui";

interface RenderEffectsControlProps {
  depthOfField: DepthOfFieldEffect | null;
  disabled?: boolean;
  onAddDepthOfField: () => void;
  onRemoveDepthOfField: () => void;
}

export function RenderEffectsControl({
  depthOfField,
  disabled = false,
  onAddDepthOfField,
  onRemoveDepthOfField,
}: RenderEffectsControlProps) {
  return (
    <div className="flex items-center gap-1.5">
      <details className="group relative">
        <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
          <Plus className="size-3" />
          Add effect
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled || depthOfField !== null}
            onClick={(event) => {
              onAddDepthOfField();
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            type="button"
          >
            Depth of Field
          </button>
        </div>
      </details>
      {depthOfField !== null && (
        <span
          className="flex h-6 items-center gap-1 rounded-full border bg-background pl-2 pr-0.5 text-[10px]"
          title="Depth of Field · nine-point autofocus"
        >
          Depth of Field
          <Button
            aria-label="Remove Depth of Field"
            className="size-5 rounded-full"
            disabled={disabled}
            onClick={onRemoveDepthOfField}
            size="icon"
            variant="ghost"
          >
            <X className="size-3" />
          </Button>
        </span>
      )}
    </div>
  );
}
