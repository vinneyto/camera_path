"use client";

import { useEffect, useRef } from "react";

import type {
  GaussianHighlightVolume,
  GaussianHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";

export function useGaussianHighlightVolume(
  backend: GaussianRenderingBackend,
  options: GaussianHighlightVolumeOptions | null,
) {
  const volumeRef = useRef<{
    backend: GaussianRenderingBackend;
    type: GaussianHighlightVolumeOptions["type"];
    volume: GaussianHighlightVolume;
  } | null>(null);

  useEffect(() => {
    if (
      volumeRef.current !== null
      && (volumeRef.current.backend !== backend || volumeRef.current.type !== options?.type)
    ) {
      volumeRef.current.volume.dispose();
      volumeRef.current = null;
    }
    if (options === null) {
      volumeRef.current?.volume.dispose();
      volumeRef.current = null;
      return;
    }
    if (volumeRef.current === null) {
      volumeRef.current = {
        backend,
        type: options.type,
        volume: backend.createHighlightVolume(options),
      };
      return;
    }
    volumeRef.current.volume.update(options);
  }, [backend, options]);

  useEffect(() => () => {
    volumeRef.current?.volume.dispose();
    volumeRef.current = null;
  }, []);
}
