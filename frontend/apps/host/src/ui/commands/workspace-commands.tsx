"use client";
import { Slot } from "@camera-path/slots";
import { CommandsProvider } from "@camera-path/ui-kit/command-palette";

export function WorkspaceCommands() {
  return (
    <CommandsProvider>
      <Slot name="project.commands" />
    </CommandsProvider>
  );
}
