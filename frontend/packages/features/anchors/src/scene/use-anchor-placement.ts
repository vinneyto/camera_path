"use client";
import { getAnchorToolModifier } from "../lib/get-anchor-tool-modifier";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useEffectEvent, useState } from "react";
import { useCameraState } from "@camera-path/store";

import { useSetActiveEditorTool } from "@camera-path/actions";
import type { SceneSurfaceHit } from "@camera-path/scene-runtime/surface";
import type { Vec3 } from "@camera-path/types/project";
import { usePointerTap } from "@camera-path/ui-kit/lib/use-pointer-tap";
import { useActiveEditorTool } from "../ports/use-active-editor-tool";

const CLICK_THRESHOLD_PX = 5;

interface UseAnchorPlacementOptions {
  onPlace: (position: Vec3, normal: Vec3) => void;
}

export function useAnchorPlacement({ onPlace }: UseAnchorPlacementOptions) {
  const { cameraMode } = useCameraState();
  const activeTool = useActiveEditorTool();
  const setActiveTool = useSetActiveEditorTool();
  const [previewHit, setPreviewHit] = useState<SceneSurfaceHit | null>(null);
  const [previousCameraMode, setPreviousCameraMode] = useState(cameraMode);
  if (previousCameraMode !== cameraMode) {
    setPreviousCameraMode(cameraMode);
    setPreviewHit(null);
  }

  function handleTap(hit: SceneSurfaceHit) {
    onPlace(hit.position, hit.normal);
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

  const cancelTap = useEffectEvent(cancelPointerTap);
  useEffect(() => {
    if (activeTool === null || cameraMode !== "orbit") cancelTap();
  }, [activeTool, cameraMode]);

  function handlePointerDown(
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) {
    const pointerType = event.nativeEvent.pointerType;
    const modifierPressed = getAnchorToolModifier(event.nativeEvent).pressed;
    const enabled =
      activeTool === "anchor" || modifierPressed || pointerType === "touch";
    if (!enabled) return;
    // A modifier may already be held when returning to the editor or refocusing the canvas.
    if (pointerType === "touch" || (modifierPressed && activeTool === null))
      setActiveTool("anchor");
    beginPointerTap(hit, event);
    setPreviewHit(hit);
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (
      activeTool === "anchor" ||
      getAnchorToolModifier(event.nativeEvent).pressed
    ) {
      if (
        activeTool === null &&
        getAnchorToolModifier(event.nativeEvent).pressed
      )
        setActiveTool("anchor");
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
    const enabled =
      activeTool === "anchor" ||
      getAnchorToolModifier(event.nativeEvent).pressed ||
      event.nativeEvent.pointerType === "touch";
    if (enabled) finishPointerTap(event);
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
