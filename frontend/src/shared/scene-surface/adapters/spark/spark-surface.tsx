"use client";

import { SplatMesh } from "@sparkjsdev/spark";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";

import type { SceneSurfaceProps } from "../../model/scene-surface-types";
import { getSparkSurfaceHit } from "./get-spark-surface-hit";
import { getSparkSurfaceReady } from "./get-spark-surface-ready";
import { useSparkSurface } from "./spark-surface-provider";

export function SparkSurface({
  name,
  onClick,
  onError,
  onLoading,
  onReady,
  source,
}: SceneSurfaceProps) {
  useSparkSurface();
  const [mesh, setMesh] = useState<SplatMesh | null>(null);

  useEffect(() => {
    let active = true;
    let loadedMesh: SplatMesh | null = null;
    onLoading?.();

    const loadTimer = window.setTimeout(() => {
      try {
        const nextMesh = new SplatMesh({
          onLoad: (readyMesh) => {
            if (active) onReady?.(getSparkSurfaceReady(readyMesh));
          },
          raycastable: true,
          url: source,
        });
        nextMesh.name = name ?? "Scene surface";
        loadedMesh = nextMesh;
        setMesh(nextMesh);
        void nextMesh.initialized.catch((reason: unknown) => {
          if (active) onError?.(reason instanceof Error ? reason : new Error(String(reason)));
        });
      } catch (reason: unknown) {
        if (active) onError?.(reason instanceof Error ? reason : new Error(String(reason)));
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      loadedMesh?.dispose();
    };
  }, [name, onError, onLoading, onReady, source]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onClick?.(getSparkSurfaceHit(event));
  }

  return mesh ? <primitive dispose={null} object={mesh} onClick={handleClick} /> : null;
}
