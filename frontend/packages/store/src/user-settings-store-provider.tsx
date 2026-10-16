"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type {
  UserSettingsState,
  UserSettingsStoreApi,
} from "./user-settings-store";

const Context = createContext<UserSettingsStoreApi | null>(null);

export function UserSettingsStoreProvider({
  store,
  children,
}: {
  store: UserSettingsStoreApi;
  children: ReactNode;
}) {
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

/** Internal selector primitive; features import the section hook instead. */
export function useUserSettingsStore<T>(
  selector: (state: UserSettingsState) => T,
): T {
  const store = useContext(Context);
  if (!store) throw new Error("UserSettingsStoreProvider is required");
  return useStore(store, selector);
}
