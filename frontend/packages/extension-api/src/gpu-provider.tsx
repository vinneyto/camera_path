"use client";
import type { GpuResourceDefinition } from "@camera-path/contracts/gpu-resources";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GpuRegistry } from "./gpu-registry";
import type { FeatureManifest } from "./manifest";
const Context = createContext<GpuRegistry | null>(null);
export function GpuProvider({
  registry,
  children,
}: {
  registry: GpuRegistry;
  children: ReactNode;
}) {
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function useFeatureGpu(manifest: FeatureManifest) {
  const registry = useContext(Context);
  if (!registry) throw new Error("GpuProvider is required");
  // The GPU API participates in effect dependency arrays; retain its identity.
  return useMemo(
    () => ({
      lease<T>(contract: GpuResourceDefinition<string, T>) {
        if (
          !manifest.contributions.some(
            (c) => c.kind === "gpu-pass" && c.inputs?.includes(contract),
          )
        )
          throw new Error(`Undeclared GPU input: ${contract.id}`);
        return registry.lease(contract);
      },
      publish<T>(contract: GpuResourceDefinition<string, T>, value: T) {
        if (
          !manifest.contributions.some(
            (c) => c.kind === "gpu-pass" && c.outputs?.includes(contract),
          )
        )
          throw new Error(`Undeclared GPU output: ${contract.id}`);
        return registry.publish(contract, manifest.id, value);
      },
    }),
    [registry, manifest],
  );
}
