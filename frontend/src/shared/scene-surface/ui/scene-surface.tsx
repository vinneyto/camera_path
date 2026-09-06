"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";
import type { SceneSurfaceProps } from "../model/scene-surface-types";
import { useSceneSurfaceBackend } from "./scene-surface-provider";

interface LoadedCloud {
  backend: GaussianRenderingBackend;
  instance: GaussianCloudInstance;
  name: string | undefined;
  source: SceneSurfaceProps["source"];
}

export function SceneSurface({
  name,
  onClick,
  onError,
  onLoading,
  onReady,
  onSurfaceClick,
  raycastable = true,
  source,
  ...objectProps
}: SceneSurfaceProps) {
  const backend = useSceneSurfaceBackend();
  const [loaded, setLoaded] = useState<LoadedCloud | null>(null);
  const cloud = loaded?.backend === backend
    && loaded.source === source
    && loaded.name === name
    ? loaded.instance
    : null;

  useEffect(() => {
    let active = true;
    let loadedCloud: GaussianCloudInstance | null = null;
    onLoading?.();

    // Avoid loading twice during React Strict Mode's development-only effect probe.
    const loadTimer = window.setTimeout(() => {
      void backend.createCloud(source, { name, raycastable }).then((result) => {
        if (!active) {
          result.dispose();
          return;
        }
        loadedCloud = result;
        setLoaded({ backend, instance: result, name, source });
        if (result.bounds !== null) onReady?.({ bounds: result.bounds });
      }).catch((reason: unknown) => {
        if (!active) return;
        onError?.(reason instanceof Error ? reason : new Error(String(reason)));
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      loadedCloud?.dispose();
    };
  }, [backend, name, onError, onLoading, onReady, raycastable, source]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (cloud === null) return;
    event.stopPropagation();
    onSurfaceClick?.(cloud.getHit(event, event.ray));
    if (typeof onClick === "function") onClick(event);
  }

  return cloud
    ? (
        <primitive
          {...objectProps}
          dispose={null}
          object={cloud.object}
          onClick={handleClick}
        />
      )
    : null;
}
