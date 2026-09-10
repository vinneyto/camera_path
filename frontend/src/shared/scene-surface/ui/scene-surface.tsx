"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";

import type { SceneSurfaceProps } from "../model/scene-surface-types";
import { useGaussianCloud } from "./use-gaussian-cloud";

export function SceneSurface({
  name,
  onClick,
  onError,
  onLoading,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onReady,
  onSurfaceClick,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerUp,
  raycastable = true,
  source,
  ...objectProps
}: SceneSurfaceProps) {
  const [cloud, loading, error] = useGaussianCloud({
    name,
    raycastable,
    source,
  });
  const notifyStatus = useEffectEvent(() => {
    if (loading) onLoading?.();
    if (error !== null) onError?.(error);
    const bounds = cloud?.bounds;
    if (bounds !== null && bounds !== undefined) onReady?.({ bounds });
  });

  useEffect(() => {
    notifyStatus();
  }, [cloud, error, loading]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (cloud === null) return;
    event.stopPropagation();
    onSurfaceClick?.(cloud.getHit(event, event.ray));
    if (typeof onClick === "function") onClick(event);
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (cloud === null) return;
    onSurfacePointerDown?.(cloud.getHit(event, event.ray), event);
    if (typeof onPointerDown === "function") onPointerDown(event);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (cloud === null) return;
    onSurfacePointerMove?.(cloud.getHit(event, event.ray), event);
    if (typeof onPointerMove === "function") onPointerMove(event);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (cloud === null) return;
    onSurfacePointerUp?.(cloud.getHit(event, event.ray), event);
    if (typeof onPointerUp === "function") onPointerUp(event);
  }

  return cloud ? (
    <primitive
      {...objectProps}
      dispose={null}
      object={cloud.object}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  ) : null;
}
