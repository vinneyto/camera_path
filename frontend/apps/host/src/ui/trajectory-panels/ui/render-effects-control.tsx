"use client";
import { Plus } from "lucide-react";
interface Effect {
  id: string;
  label: string;
  disabled: boolean;
  run: () => void;
}
export function RenderEffectsControl({
  effects,
}: {
  effects: readonly Effect[];
}) {
  if (!effects.length) return null;
  return (
    <details className="group relative">
      <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent">
        <Plus className="size-3" />
        Add effect
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        {effects.map((effect) => (
          <button
            key={effect.id}
            disabled={effect.disabled}
            type="button"
            className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-45"
            onClick={(event) => {
              effect.run();
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {effect.label}
          </button>
        ))}
      </div>
    </details>
  );
}
