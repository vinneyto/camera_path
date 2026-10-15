"use client";
import type { CommandState } from "@camera-path/types/commands";
import { createContext, useContext, useState, type ReactNode } from "react";
import { CommandPalette } from "./command-palette";

interface CommandRegistration {
  publish: (owner: string, state: CommandState) => void;
  remove: (owner: string) => void;
}

const CommandRegistrationContext = createContext<CommandRegistration | null>(
  null,
);

export function CommandsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState(new Map<string, CommandState>());
  // Registrars must not subscribe to the changing list they publish into.
  const [registration] = useState<CommandRegistration>(() => ({
    publish: (owner, state) => {
      setEntries((current) => new Map(current).set(owner, state));
    },
    remove: (owner) => {
      setEntries((current) => {
        const next = new Map(current);
        next.delete(owner);
        return next;
      });
    },
  }));
  const commands = [...entries.values()].flatMap((entry) =>
    entry.commands.map((command) => ({
      ...command,
      disabled: entry.disabled || command.disabled,
    })),
  );
  const ids = new Set<string>();
  for (const command of commands) {
    if (ids.has(command.id)) {
      throw new Error(`Duplicate command ID: ${command.id}`);
    }
    ids.add(command.id);
  }

  return (
    <CommandRegistrationContext value={registration}>
      {children}
      {commands.length > 0 && <CommandPalette commands={commands} />}
      {[...entries].map(([owner, entry]) =>
        entry.error ? (
          <p key={owner} role="alert" className="text-xs text-destructive">
            {entry.error}
          </p>
        ) : null,
      )}
    </CommandRegistrationContext>
  );
}

export function useCommandRegistration() {
  const registration = useContext(CommandRegistrationContext);
  if (!registration) {
    throw new Error("useRegisterCommands requires CommandsProvider");
  }
  return registration;
}
