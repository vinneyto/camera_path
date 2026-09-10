"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import type { GaussianCloudInstance } from "../model/gaussian-rendering-backend";
import type { GaussianCloudSource } from "../model/scene-surface-types";
import { useGaussianCloudResourceCache } from "./scene-surface-provider";

interface LoadedGaussianCloud {
  instance: GaussianCloudInstance;
  name: string | undefined;
  source: GaussianCloudSource;
}

interface UseGaussianCloudOptions {
  name?: string;
  raycastable: boolean;
  source: GaussianCloudSource;
}

type UseGaussianCloudResult = readonly [
  cloud: GaussianCloudInstance | null,
  loading: boolean,
  error: Error | null,
];

export function useGaussianCloud({
  name,
  raycastable,
  source,
}: UseGaussianCloudOptions): UseGaussianCloudResult {
  const cache = useGaussianCloudResourceCache();
  const [loaded, setLoaded] = useState<LoadedGaussianCloud | null>(null);
  const [failed, setFailed] = useState<{
    error: Error;
    name: string | undefined;
    source: GaussianCloudSource;
  } | null>(null);
  const cloud =
    loaded?.source === source && loaded.name === name ? loaded.instance : null;
  const error =
    failed?.source === source && failed.name === name ? failed.error : null;

  useEffect(() => {
    let active = true;
    const lease = cache.acquire(source, { name });
    void lease.promise
      .then((result) => {
        if (!active) return;
        setFailed(null);
        setLoaded({ instance: result, name, source });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        setFailed({ error, name, source });
      });

    return () => {
      active = false;
      lease.release();
    };
  }, [cache, name, source]);

  useLayoutEffect(() => {
    cloud?.setRaycastable(raycastable);
  }, [cloud, raycastable]);

  return [cloud, cloud === null && error === null, error];
}
