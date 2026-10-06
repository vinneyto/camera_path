"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";

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
  enabled?: boolean;
  onPlace: (position: Vec3, normal: Vec3) => void;
}

export function useAnchorPlacement({
  onPlace,
  enabled = true,
}: UseAnchorPlacementOptions) {
  const activeTool = useActiveEditorTool();
  const setActiveTool = useSetActiveEditorTool();
  const [previewHit, setPreviewHit] = useState<SceneSurfaceHit | null>(null);

  function handleTap(hit: SceneSurfaceHit) {
    if (enabled) onPlace(hit.position, hit.normal);
  }
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

  function handlePointerDown(
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) {
    const pointerType = event.nativeEvent.pointerType;
    const pointerEnabled =
      activeTool === "anchor" ||
      getAnchorToolModifier(event.nativeEvent).pressed ||
      pointerType === "touch";
    if (!enabled || !pointerEnabled) return;
    if (pointerType === "touch") setActiveTool("anchor");
    beginPointerTap(hit, event);
    setPreviewHit(hit);
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (
      enabled &&
      (activeTool === "anchor" ||
        getAnchorToolModifier(event.nativeEvent).pressed)
    ) {
      setPreviewHit(hit);
    }
    const moved = movePointerTap(hit, event);
    if (moved) setPreviewHit(null);
  }

  function handlePointerUp(
    _hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) {
    (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    const pointerEnabled =
      activeTool === "anchor" ||
      getAnchorToolModifier(event.nativeEvent).pressed ||
      event.nativeEvent.pointerType === "touch";
    if (enabled && pointerEnabled) finishPointerTap(event);
    else cancelPointerTap();
    if (event.nativeEvent.pointerType === "touch") {
      setPreviewHit(null);
      setActiveTool(null);
    }
  }

  function handleControlsChange() {
    cancelPointerTap();
    setPreviewHit(null);
  }

  function handlePointerOut() {
    setPreviewHit(null);
  }

  function handlePointerCancel(event: ThreeEvent<PointerEvent>) {
    cancelPointerTap();
    setPreviewHit(null);
    if (event.nativeEvent.pointerType === "touch") setActiveTool(null);
  }

  return {
    handleControlsChange,
    previewHit: enabled && activeTool === "anchor" ? previewHit : null,
    surfaceEventProps: {
      onPointerCancel: handlePointerCancel,
      onPointerOut: handlePointerOut,
      onSurfacePointerDown: handlePointerDown,
      onSurfacePointerMove: handlePointerMove,
      onSurfacePointerUp: handlePointerUp,
    },
  };
}
