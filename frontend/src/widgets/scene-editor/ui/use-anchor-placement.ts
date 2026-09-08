"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";

import type { Vec3 } from "@/entities/project";
import {
  getAnchorToolModifier,
  useActiveEditorTool,
  useSetActiveEditorTool,
} from "@/features/project-editor";
import type { SceneSurfaceHit } from "@/shared/scene-surface";
import { usePointerTap } from "@/shared/lib/use-pointer-tap";

const CLICK_THRESHOLD_PX = 5;

interface UseAnchorPlacementOptions {
  onPlace: (position: Vec3, normal: Vec3) => void;
}

export function useAnchorPlacement({ onPlace }: UseAnchorPlacementOptions) {
  const activeTool = useActiveEditorTool();
  const setActiveTool = useSetActiveEditorTool();
  const [previewHit, setPreviewHit] = useState<SceneSurfaceHit | null>(null);

  const handleTap = useCallback((hit: SceneSurfaceHit) => {
    onPlace(hit.position, hit.normal);
  }, [onPlace]);
  const {
    cancel: cancelPointerTap,
    handlePointerDown: beginPointerTap,
    handlePointerMove: movePointerTap,
    handlePointerUp: finishPointerTap,
  } = usePointerTap({
    movementThreshold: CLICK_THRESHOLD_PX,
    onTap: handleTap,
  });

  useEffect(() => {
    if (activeTool === null) cancelPointerTap();
  }, [activeTool, cancelPointerTap]);

  const handlePointerDown = useCallback((
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    const pointerType = event.nativeEvent.pointerType;
    const enabled = activeTool === "anchor"
      || getAnchorToolModifier(event.nativeEvent).pressed
      || pointerType === "touch";
    if (!enabled) return;
    if (pointerType === "touch") setActiveTool("anchor");
    beginPointerTap(hit, event);
    setPreviewHit(hit);
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  }, [activeTool, beginPointerTap, setActiveTool]);

  const handlePointerMove = useCallback((
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (activeTool === "anchor" || getAnchorToolModifier(event.nativeEvent).pressed) {
      setPreviewHit(hit);
    }
    const moved = movePointerTap(hit, event);
    if (moved) setPreviewHit(null);
  }, [activeTool, movePointerTap]);

  const handlePointerUp = useCallback((
    _hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    const enabled = activeTool === "anchor"
      || getAnchorToolModifier(event.nativeEvent).pressed
      || event.nativeEvent.pointerType === "touch";
    if (enabled) finishPointerTap(event);
    else cancelPointerTap();
    if (event.nativeEvent.pointerType === "touch") {
      setPreviewHit(null);
      setActiveTool(null);
    }
  }, [activeTool, cancelPointerTap, finishPointerTap, setActiveTool]);

  const handleControlsChange = useCallback(() => {
    cancelPointerTap();
    setPreviewHit(null);
  }, [cancelPointerTap]);

  const handlePointerOut = useCallback(() => {
    setPreviewHit(null);
  }, []);

  const handlePointerCancel = useCallback((event: ThreeEvent<PointerEvent>) => {
    cancelPointerTap();
    setPreviewHit(null);
    if (event.nativeEvent.pointerType === "touch") setActiveTool(null);
  }, [cancelPointerTap, setActiveTool]);

  return {
    handleControlsChange,
    previewHit: activeTool === "anchor" ? previewHit : null,
    surfaceEventProps: {
      onPointerCancel: handlePointerCancel,
      onPointerOut: handlePointerOut,
      onSurfacePointerDown: handlePointerDown,
      onSurfacePointerMove: handlePointerMove,
      onSurfacePointerUp: handlePointerUp,
    },
  };
}
