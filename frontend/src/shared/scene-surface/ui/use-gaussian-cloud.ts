"use client";

import { useEffect, useState } from "react";

import type { GaussianCloudLoadProgress } from "../model/gaussian-cloud-load-progress";
import type { GaussianCloudInstance } from "../model/gaussian-rendering-backend";
import type { GaussianCloudSource } from "../model/scene-surface-types";
import { useGaussianCloudResourceCache } from "./scene-surface-provider";

interface LoadedGaussianCloud {
  instance: GaussianCloudInstance;
  resourceKey: string | undefined;
  name: string | undefined;
  source: GaussianCloudSource;
}

interface UseGaussianCloudOptions {
  name?: string;
  initialWorldMatrix?: readonly number[];
  resourceKey?: string;
  source: GaussianCloudSource;
}

type UseGaussianCloudResult = readonly [
  cloud: GaussianCloudInstance | null,
  loading: boolean,
  error: Error | null,
  progress: GaussianCloudLoadProgress | null,
];

export function useGaussianCloud({
  name,
  initialWorldMatrix,
  resourceKey,
  source,
}: UseGaussianCloudOptions): UseGaussianCloudResult {
  const cache = useGaussianCloudResourceCache();
  const [progressState, setProgressState] = useState<{
    source: GaussianCloudSource;
    resourceKey: string | undefined;
    name: string | undefined;
    value: GaussianCloudLoadProgress;
  } | null>(null);
  const [loaded, setLoaded] = useState<LoadedGaussianCloud | null>(null);
  const [failed, setFailed] = useState<{
    error: Error;
    name: string | undefined;
    source: GaussianCloudSource;
  } | null>(null);
  const cloud =
    loaded &&
    (resourceKey === undefined
      ? loaded.resourceKey === undefined &&
        loaded.source === source &&
        loaded.name === name
      : loaded.resourceKey === resourceKey)
      ? loaded.instance
      : null;
  const error =
    failed?.source === source && failed.name === name ? failed.error : null;

  useEffect(() => {
    let active = true;
    const lease = cache.acquire(
      source,
      { name, worldMatrix: initialWorldMatrix },
      resourceKey,
    );
    const unsubscribeProgress = lease.subscribeProgress((value) => {
      if (active) setProgressState({ source, resourceKey, name, value });
    });
    void lease.promise
      .then((result) => {
        if (!active) return;
        setFailed(null);
        setLoaded({ instance: result, name, source, resourceKey });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        setFailed({ error, name, source });
      });

    return () => {
      active = false;
      unsubscribeProgress();
      lease.release();
    };
  }, [cache, name, initialWorldMatrix, resourceKey, source]);

  const progress =
    progressState &&
    (resourceKey === undefined
      ? progressState.resourceKey === undefined &&
        progressState.source === source &&
        progressState.name === name
      : progressState.resourceKey === resourceKey)
      ? progressState.value
      : null;
  return [cloud, cloud === null && error === null, error, progress];
}
