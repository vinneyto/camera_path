"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { EditorState, EditorStoreApi } from "./editor-store";
const Context = createContext<EditorStoreApi | null>(null);
/** The host creates and owns the vanilla store. */
export function EditorStoreProvider({
  store,
  children,
}: {
  store: EditorStoreApi;
  children: ReactNode;
}) {
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useEditorStoreApi() {
  const store = useContext(Context);
  if (!store) throw new Error("EditorStoreProvider is required");
  return store;
}
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStoreApi(), selector);
}
