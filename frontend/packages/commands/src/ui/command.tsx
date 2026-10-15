"use client";
import type { CommandPaletteCommand } from "../types";
import { useRegisterCommands } from "../model/use-register-commands";

export type CommandProps = CommandPaletteCommand & {
  /** Mutation/action failure shown below the palette; item-loading errors use error. */
  actionError?: string | null;
};

export function Command({ actionError = null, ...command }: CommandProps) {
  useRegisterCommands([command], { error: actionError });
  return null;
}
