"use client";
import { CommandProvider } from "@camera-path/extension-api/command-provider";
import { ExtensionSlot } from "@camera-path/extension-api";
import { CommandPaletteHost } from "./command-palette-host";
export function WorkspaceCommands() {
  return (
    <CommandProvider>
      <ExtensionSlot name="workspace.commands" />
      <CommandPaletteHost />
    </CommandProvider>
  );
}
