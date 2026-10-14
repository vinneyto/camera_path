"use client";
import { createContext, useContext, type ReactNode } from "react";
const Context = createContext(false);
export function EditableProvider({
  editable,
  children,
}: {
  editable: boolean;
  children: ReactNode;
}) {
  return <Context.Provider value={editable}>{children}</Context.Provider>;
}
export function Editable({ children }: { children: ReactNode }) {
  return useContext(Context) ? children : null;
}
