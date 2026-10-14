"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { HostRuntime } from "./host-runtime";
import type { FeatureManifest } from "./manifest";
const Context = createContext<HostRuntime | null>(null);
export function HostProvider({
  runtime,
  children,
}: {
  runtime: HostRuntime;
  children: ReactNode;
}) {
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}
export function useFeatureHost<const M extends FeatureManifest>(manifest: M) {
  const runtime = useContext(Context);
  if (!runtime) throw new Error("HostProvider is required");
  return runtime.feature(manifest);
}
export function useHostRuntime() {
  const runtime = useContext(Context);
  if (!runtime) throw new Error("HostProvider is required");
  return runtime;
}
