"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { GaussianCloud } from "3dgs-tile-webgpu";

import type { SceneSurfaceProps } from "../../model/scene-surface-types";
import { getTileSurfaceHit } from "./get-tile-surface-hit";
import { getTileSurfaceReady } from "./get-tile-surface-ready";
import { useTileSurface } from "./tile-surface-provider";

export function TileSurface({
  name,
  onClick,
  onError,
  onLoading,
  onReady,
  source,
}: SceneSurfaceProps) {
  const { registerSurface, store } = useTileSurface();
  const [cloud, setCloud] = useState<GaussianCloud | null>(null);

  useEffect(() => {
    let active = true;
    let loadedCloud: GaussianCloud | null = null;
    let unregister: (() => void) | null = null;
    onLoading?.();

    // Deferring one tick avoids downloading and parsing the PLY twice during
    // React Strict Mode's development-only effect probe.
    const loadTimer = window.setTimeout(() => {
      void store.load(source, { name }).then((result) => {
        if (!active) {
          result.dispose();
          return;
        }
        loadedCloud = result;
        result.raycastMode = "full";
        unregister = registerSurface();
        setCloud(result);
        const ready = getTileSurfaceReady(result);
        if (ready !== null) onReady?.(ready);
      }).catch((reason: unknown) => {
        if (!active) return;
        onError?.(reason instanceof Error ? reason : new Error(String(reason)));
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      unregister?.();
      loadedCloud?.dispose();
    };
  }, [name, onError, onLoading, onReady, registerSurface, source, store]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onClick?.(getTileSurfaceHit(event));
  }

  return cloud
    ? <primitive dispose={null} object={cloud} onClick={handleClick} />
    : null;
}
