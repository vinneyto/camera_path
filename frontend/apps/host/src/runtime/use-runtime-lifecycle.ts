"use client";
import type { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useEffect, useRef } from "react";
export function useRuntimeLifecycle(runtime: HostRuntime) {
  const generation = useRef(0);
  useEffect(() => {
    const lifetime = generation;
    lifetime.current++;
    return () => {
      const ticket = ++lifetime.current;
      // Strict Mode replays setup synchronously. Dispose only a released scope.
      queueMicrotask(() => {
        if (lifetime.current === ticket) runtime.dispose();
      });
    };
  }, [runtime]);
}
