"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";

import type { SceneSurfaceProps } from "../model/scene-surface-types";
import { useGaussianCloud } from "./use-gaussian-cloud";

export function SceneSurface({
  name,
  onClick,
  onContextMenu,
  onDoubleClick,
  onError,
  onLoading,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerOut,
  onPointerOver,
  onPointerUp,
  onReady,
  onSurfaceClick,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerUp,
  onWheel,
  raycastable = true,
  source,
  ...objectProps
}: SceneSurfaceProps) {
  const [cloud, loading, error] = useGaussianCloud({
    name,
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

  const interactionProps = raycastable
    ? {
        onClick: handleClick,
        onContextMenu,
        onDoubleClick,
        onPointerCancel,
        onPointerDown: handlePointerDown,
        onPointerEnter,
        onPointerLeave,
        onPointerMove: handlePointerMove,
        onPointerOut,
        onPointerOver,
        onPointerUp: handlePointerUp,
        onWheel,
      }
    : {};

  return cloud ? (
    <primitive
      {...objectProps}
      {...interactionProps}
      dispose={null}
      object={cloud.object}
    />
  ) : null;
}
