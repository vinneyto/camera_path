"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { FeatureSlots } from "./feature-slots";
const Context = createContext<readonly FeatureSlots[] | null>(null);
/** A static feature catalog, in mounting order. No registration or activation lifecycle. */
export function SlotProvider({
  features,
  children,
}: {
  features: readonly FeatureSlots[];
  children: ReactNode;
}) {
  return <Context.Provider value={features}>{children}</Context.Provider>;
}
export function useFeatureSlots() {
  const features = useContext(Context);
  if (!features) throw new Error("SlotProvider is required");
  return features;
}
