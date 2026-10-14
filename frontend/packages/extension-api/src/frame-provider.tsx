"use client";
import {
  createContext,
  useContext,
  useLayoutEffect,
  type ReactNode,
} from "react";
import type { FrameContext, FrameRegistry } from "./frame-registry";
import type { FeatureManifest } from "./manifest";
const Context = createContext<FrameRegistry | null>(null);
export function FrameProvider({
  registry,
  children,
}: {
  registry: FrameRegistry;
  children: ReactNode;
}) {
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function useHostFrame(
  manifest: FeatureManifest,
  id: string,
  handler: (context: FrameContext) => void,
) {
  const registry = useContext(Context);
  if (!registry) throw new Error("FrameProvider is required");
  useLayoutEffect(
    () => registry.declare(manifest, id, handler),
    [registry, manifest, id, handler],
  );
}
