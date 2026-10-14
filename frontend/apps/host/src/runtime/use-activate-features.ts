"use client";
import type { FeatureManifest } from "@camera-path/extension-api";
import type { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useLayoutEffect } from "react";
// Each registration receives the context of its own manifest, never a runtime or a sibling.
export function useActivateFeatures(
  runtime: HostRuntime,
  features: readonly {
    manifest: FeatureManifest;
    register?: (host: never) => () => void;
  }[],
) {
  useLayoutEffect(() => {
    const off = features.map((feature) => {
      const context = runtime.feature(feature.manifest);
      return feature.register?.(context as never);
    });
    return () => off.reverse().forEach((dispose) => dispose?.());
  }, [runtime, features]);
}
