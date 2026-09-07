"use client";

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { useStore } from "zustand";

import {
  createEditorStore,
  type EditorStore,
  type EditorStoreApi,
} from "./editor-store";

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export function EditorStoreProvider({ children }: PropsWithChildren) {
  const [store] = useState(createEditorStore);
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore<T>(selector: (state: EditorStore) => T): T {
  return useStore(useEditorStoreApi(), selector);
}

export function useEditorStoreApi(): EditorStoreApi {
  const store = useContext(EditorStoreContext);
  if (store === null) throw new Error("Editor state must be used inside EditorStoreProvider");
  return store;
}
