"use client";
import type { RequestDefinition } from "@camera-path/contracts/contract-types";
import type { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useLayoutEffect } from "react";
export function useBindRequest<I, O>(
  runtime: HostRuntime,
  contract: RequestDefinition<string, I, O>,
  handler: (input: I, signal: AbortSignal) => Promise<O> | O,
) {
  useLayoutEffect(
    () => runtime.bindRequest(contract, handler),
    [runtime, contract, handler],
  );
}
