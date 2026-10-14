"use client";
import { CommandProvider } from "@camera-path/extension-api/command-provider";
import { commandContributions } from "@host/composition/commands";
import { CommandPaletteHost } from "./command-palette-host";
export function WorkspaceCommands({ projectId }: { projectId: string }) {
  return (
    <CommandProvider>
      {commandContributions.map(({ id, Component }) => (
        <Component key={id} projectId={projectId} />
      ))}
      <CommandPaletteHost />
    </CommandProvider>
  );
}
