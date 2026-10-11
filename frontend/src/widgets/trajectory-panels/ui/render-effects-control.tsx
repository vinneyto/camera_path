"use client";

import { Plus } from "lucide-react";

interface RenderEffectsControlProps {
  disabled?: boolean;
  hasDepthOfField: boolean;
  hasLidar?: boolean;
  lidarPending?: boolean;
  onAddLidar?: () => void;
  onAddDepthOfField: () => void;
}

export function RenderEffectsControl({
  disabled = false,
  hasDepthOfField,
  hasLidar = false,
  lidarPending = false,
  onAddLidar,
  onAddDepthOfField,
}: RenderEffectsControlProps) {
  if (hasDepthOfField && (hasLidar || !onAddLidar)) return null;

  return (
    <div className="flex items-center gap-1.5">
      <details className="group relative">
        <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
          <Plus className="size-3" />
          Add effect
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {!hasDepthOfField && (
            <button
              className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              disabled={disabled}
              onClick={(event) => {
                onAddDepthOfField();
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              type="button"
            >
              Depth of Field
            </button>
          )}
          {onAddLidar && !hasLidar && (
            <button
              type="button"
              disabled={lidarPending}
              className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-45"
              onClick={(event) => {
                onAddLidar();
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              LiDAR
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
