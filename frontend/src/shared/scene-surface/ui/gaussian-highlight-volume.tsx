"use client";

import { useEffect, useRef } from "react";

import type {
  GaussianHighlightVolumeInstance,
  GaussianHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";

interface GaussianHighlightVolumeProps {
  backend: GaussianRenderingBackend;
  options: GaussianHighlightVolumeOptions;
}

export function GaussianHighlightVolume({
  backend,
  options,
}: GaussianHighlightVolumeProps) {
  const instanceRef = useRef<{
    backend: GaussianRenderingBackend;
    instance: GaussianHighlightVolumeInstance;
    type: GaussianHighlightVolumeOptions["type"];
  } | null>(null);

  useEffect(() => {
    if (
      instanceRef.current !== null
      && (instanceRef.current.backend !== backend || instanceRef.current.type !== options.type)
    ) {
      instanceRef.current.instance.dispose();
      instanceRef.current = null;
    }
    if (instanceRef.current === null) {
      instanceRef.current = {
        backend,
        instance: backend.createHighlightVolume(options),
        type: options.type,
      };
      return;
    }
    instanceRef.current.instance.update(options);
  }, [backend, options]);

  useEffect(() => () => {
    instanceRef.current?.instance.dispose();
    instanceRef.current = null;
  }, []);

  return null;
}
