"use client";
import { useSyncExternalStore } from "react";
import type { Readable } from "./feature-context";
import { useFeatureHost } from "./host-provider";
import type { FeatureManifest } from "./manifest";
export function useDataQuery<
  const M extends FeatureManifest,
  C extends Readable<M>,
>(manifest: M, contract: C) {
  const host = useFeatureHost(manifest);
  const state = useSyncExternalStore(
    (fn) => host.data.subscribe(contract, fn),
    () => host.data.state(contract),
    () => host.data.state(contract),
  );
  return {
    data:
      state.status === "ready"
        ? { data: state.value, status: 200 as const }
        : undefined,
    error: state.error,
    isPending: state.status === "loading",
    isSuccess: state.status === "ready",
  };
}
