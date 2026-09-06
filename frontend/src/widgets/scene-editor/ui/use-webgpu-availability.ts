import { useSyncExternalStore } from "react";

export function useWebGpuAvailability(): boolean | null {
  return useSyncExternalStore(
    () => () => undefined,
    () => "gpu" in navigator,
    () => null,
  );
}
