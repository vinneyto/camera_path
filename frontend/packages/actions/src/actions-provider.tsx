"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { EditorActions } from "./create-editor-actions";
const Context = createContext<EditorActions | null>(null);
export function EditorActionsProvider({
  actions,
  children,
}: {
  actions: EditorActions;
  children: ReactNode;
}) {
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}
export function useEditorActions() {
  const actions = useContext(Context);
  if (!actions) throw new Error("EditorActionsProvider is required");
  return actions;
}
