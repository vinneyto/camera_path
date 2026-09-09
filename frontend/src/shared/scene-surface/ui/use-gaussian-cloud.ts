"use client";

import { useEffect, useRef, useState } from "react";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";
import type {
  GaussianCloudSource,
  SceneSurfaceReady,
} from "../model/scene-surface-types";

interface LoadedGaussianCloud {
  backend: GaussianRenderingBackend;
  instance: GaussianCloudInstance;
  name: string | undefined;
  source: GaussianCloudSource;
}

interface UseGaussianCloudOptions {
  backend: GaussianRenderingBackend;
  name?: string;
  onError?: (error: Error) => void;
  onLoading?: () => void;
  onReady?: (surface: SceneSurfaceReady) => void;
  raycastable: boolean;
  source: GaussianCloudSource;
}

export function useGaussianCloud({
  backend,
  name,
  onError,
  onLoading,
  onReady,
  raycastable,
  source,
}: UseGaussianCloudOptions): GaussianCloudInstance | null {
  const [loaded, setLoaded] = useState<LoadedGaussianCloud | null>(null);
  const raycastableRef = useRef(raycastable);
  const cloud = loaded?.backend === backend
    && loaded.source === source
    && loaded.name === name
    ? loaded.instance
    : null;

  useEffect(() => {
    raycastableRef.current = raycastable;
  }, [raycastable]);

  useEffect(() => {
    let active = true;
    let loadedCloud: GaussianCloudInstance | null = null;
    onLoading?.();

    // Avoid loading twice during React Strict Mode's development-only effect probe.
    const loadTimer = window.setTimeout(() => {
      void backend.createCloud(source, {
        name,
        raycastable: raycastableRef.current,
      }).then((result) => {
        if (!active) {
          result.dispose();
          return;
        }
        loadedCloud = result;
        result.setRaycastable(raycastableRef.current);
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
  }, [backend, name, onError, onLoading, onReady, source]);

  useEffect(() => {
    cloud?.setRaycastable(raycastable);
  }, [cloud, raycastable]);

  return cloud;
}
