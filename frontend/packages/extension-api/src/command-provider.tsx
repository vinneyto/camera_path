"use client";
import type { CommandState } from "@camera-path/contracts/commands";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CommandRegistry } from "./command-registry";
import type { FeatureManifest } from "./manifest";
const Context = createContext<CommandRegistry | null>(null);
export function CommandProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function usePublishCommands(
  manifest: FeatureManifest,
  id: string,
  state: CommandState,
) {
  const registry = useContext(Context);
  if (!registry) throw new Error("CommandProvider is required");
  useLayoutEffect(
    () => registry.publish(manifest, id, state),
    [registry, manifest, id, state],
  );
}
export function useCommands() {
  const registry = useContext(Context);
  if (!registry) throw new Error("CommandProvider is required");
  return useSyncExternalStore(registry.subscribe, registry.read, registry.read);
}
