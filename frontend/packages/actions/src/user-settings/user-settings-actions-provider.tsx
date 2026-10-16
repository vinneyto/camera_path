"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { UserSettingsActions } from "./create-user-settings-actions";

type PublicActions = Pick<UserSettingsActions, "save" | "retry">;
const Context = createContext<PublicActions | null>(null);

export function UserSettingsActionsProvider({
  actions,
  children,
}: {
  actions: PublicActions;
  children: ReactNode;
}) {
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}

export function useUserSettingsActions(): PublicActions {
  const actions = useContext(Context);
  if (!actions) throw new Error("UserSettingsActionsProvider is required");
  return actions;
}
