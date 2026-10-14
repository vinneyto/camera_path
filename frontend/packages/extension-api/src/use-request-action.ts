"use client";
import type {
  RequestInput,
  RequestOutput,
} from "@camera-path/contracts/contract-types";
import { useCallback } from "react";
import type { Callable } from "./feature-context";
import { useFeatureHost } from "./host-provider";
import type { FeatureManifest } from "./manifest";
export function useRequestAction<
  const M extends FeatureManifest,
  C extends Callable<M>,
>(manifest: M, contract: C) {
  const host = useFeatureHost(manifest);
  // Stable identity is required by consumers registering pointer/keyboard effects.
  return useCallback(
    async (input: RequestInput<C>): Promise<RequestOutput<C>> => {
      const result = await host.requests.call(contract, input);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    [host, contract],
  );
}
