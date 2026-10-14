"use client";
import type { ContractValue } from "@camera-path/contracts/contract-types";
import { useSyncExternalStore } from "react";
import type { Readable } from "./feature-context";
import { useFeatureHost } from "./host-provider";
import type { FeatureManifest } from "./manifest";
export function useData<const M extends FeatureManifest, C extends Readable<M>>(
  manifest: M,
  contract: C,
): ContractValue<C> {
  const host = useFeatureHost(manifest);
  return useSyncExternalStore(
    (fn) => host.data.subscribe(contract, fn),
    () => host.data.read(contract),
    () => host.data.read(contract),
  );
}
