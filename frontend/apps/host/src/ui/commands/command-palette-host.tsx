"use client";
import { useCommands } from "@camera-path/extension-api/command-provider";
import { CommandPalette } from "@camera-path/ui-kit/command-palette";
export function CommandPaletteHost() {
  const state = useCommands();
  if (!state.commands.length && !state.error) return null;
  return (
    <div className="space-y-1">
      <CommandPalette commands={state.commands} disabled={state.disabled} />
      {state.error && (
        <p
          className="rounded border bg-background px-2 py-1 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </div>
  );
}
