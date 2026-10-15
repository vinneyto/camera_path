"use client";
import type { CommandPaletteCommand } from "../types";
import { useId, useLayoutEffect } from "react";
import { useCommandRegistration } from "../ui/commands-provider";

export function useRegisterCommands(
  commands: readonly CommandPaletteCommand[],
  {
    disabled = false,
    error = null,
  }: { disabled?: boolean; error?: string | null } = {},
) {
  const owner = useId();
  const registration = useCommandRegistration();
  useLayoutEffect(() => {
    registration.publish(owner, { commands, disabled, error });
  }, [registration, owner, commands, disabled, error]);
  useLayoutEffect(
    () => () => registration.remove(owner),
    [registration, owner],
  );
}
