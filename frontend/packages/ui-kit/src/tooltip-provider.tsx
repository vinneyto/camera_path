"use client";
import {
  createContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export const TooltipContext = createContext<
  [string | null, Dispatch<SetStateAction<string | null>>] | null
>(null);

/** A scope has at most one visible tooltip, including keyboard and pointer input. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null);
  return (
    <TooltipContext.Provider value={state}>{children}</TooltipContext.Provider>
  );
}
