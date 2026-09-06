"use client";

import type { ThreeEvent } from "@react-three/fiber";

import type { SceneSurfaceProps } from "../model/scene-surface-types";
import { useSceneSurfaceBackend } from "./scene-surface-provider";
import { useGaussianCloud } from "./use-gaussian-cloud";

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
  const cloud = useGaussianCloud({
    backend,
    name,
    onError,
    onLoading,
    onReady,
    raycastable,
    source,
  });

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
