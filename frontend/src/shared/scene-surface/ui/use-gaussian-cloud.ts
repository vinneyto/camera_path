"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

interface GaussianCloudLoad {
  backend: GaussianRenderingBackend;
  disposed: boolean;
  name: string | undefined;
  promise: Promise<GaussianCloudInstance>;
  source: GaussianCloudSource;
  users: number;
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
  const loadRef = useRef<GaussianCloudLoad | null>(null);
  const cloud = loaded?.backend === backend
    && loaded.source === source
    && loaded.name === name
    ? loaded.instance
    : null;

  useEffect(() => {
    let active = true;
    onLoading?.();

    let load = loadRef.current;
    if (
      load === null
      || load.backend !== backend
      || load.source !== source
      || load.name !== name
      || load.disposed
    ) {
      load = {
        backend,
        disposed: false,
        name,
        promise: backend.createCloud(source, { name }),
        source,
        users: 0,
      };
      loadRef.current = load;
    }
    load.users += 1;

    void load.promise.then((result) => {
      if (!active) return;
      setLoaded({ backend, instance: result, name, source });
      if (result.bounds !== null) onReady?.({ bounds: result.bounds });
    }).catch((reason: unknown) => {
      if (!active) return;
      onError?.(reason instanceof Error ? reason : new Error(String(reason)));
    });

    return () => {
      active = false;
      load.users -= 1;
      // A Strict Mode probe starts its replacement effect before this microtask runs.
      queueMicrotask(() => {
        if (load.users > 0 || load.disposed) return;
        load.disposed = true;
        if (loadRef.current === load) loadRef.current = null;
        void load.promise.then((result) => result.dispose()).catch(() => undefined);
      });
    };
  }, [backend, name, onError, onLoading, onReady, source]);

  useLayoutEffect(() => {
    cloud?.setRaycastable(raycastable);
  }, [cloud, raycastable]);

  return cloud;
}
