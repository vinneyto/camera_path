"use client";
import type {
  RequestInput,
  RequestOutput,
} from "@camera-path/contracts/contract-types";
import { useEffect, useRef, useState } from "react";
import type { Callable } from "./feature-context";
import { useFeatureHost } from "./host-provider";
import type { FeatureManifest } from "./manifest";
export function useRequestMutation<
  const M extends FeatureManifest,
  C extends Callable<M>,
>(manifest: M, contract: C, projectId?: string) {
  const host = useFeatureHost(manifest);
  if (projectId !== undefined && projectId !== host.scopeId)
    throw new Error(`Project scope mismatch: ${projectId} ≠ ${host.scopeId}`);
  const active = useRef(true);
  const sequence = useRef(0);
  const [state, setState] = useState<{
    error: Error | null;
    isPending: boolean;
    isSuccess: boolean;
    variables?: RequestInput<C>;
  }>({ error: null, isPending: false, isSuccess: false });
  useEffect(() => {
    const mounted = active;
    const calls = sequence;
    mounted.current = true;
    return () => {
      mounted.current = false;
      calls.current++;
    };
  }, []);
  async function mutateAsync(
    variables: RequestInput<C>,
  ): Promise<RequestOutput<C>> {
    const id = ++sequence.current;
    setState({ error: null, isPending: true, isSuccess: false, variables });
    try {
      const result = await host.requests.call(contract, variables);
      if (!result.ok) throw new Error(result.error.message);
      if (active.current && id === sequence.current)
        setState({ error: null, isPending: false, isSuccess: true, variables });
      return result.value;
    } catch (error) {
      if (active.current && id === sequence.current)
        setState({
          error: error instanceof Error ? error : new Error(String(error)),
          isPending: false,
          isSuccess: false,
          variables,
        });
      throw error;
    }
  }
  return {
    ...state,
    reset: () => {
      sequence.current++;
      setState({ error: null, isPending: false, isSuccess: false });
    },
    mutateAsync,
    mutate: (
      variables: RequestInput<C>,
      options?: { onSuccess?: (value: RequestOutput<C>) => void },
    ) => {
      void mutateAsync(variables)
        .then(options?.onSuccess)
        .catch(() => {});
    },
  };
}
