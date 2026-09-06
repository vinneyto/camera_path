"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Vec3 } from "@/entities/project";
import { useEditorStore } from "@/features/project-editor";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

import { AnchorPlacementGesture } from "../lib/anchor-placement-gesture";

const CLICK_THRESHOLD_PX = 5;

interface UseAnchorPlacementOptions {
  onPlace: (position: Vec3, normal: Vec3) => void;
}

export function useAnchorPlacement({ onPlace }: UseAnchorPlacementOptions) {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const gestureRef = useRef(new AnchorPlacementGesture(CLICK_THRESHOLD_PX));
  const [previewHit, setPreviewHit] = useState<SceneSurfaceHit | null>(null);

  useEffect(() => {
    if (activeTool === null) gestureRef.current.cancel();
  }, [activeTool]);

  const handlePointerDown = useCallback((
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    const pointerType = event.nativeEvent.pointerType;
    const enabled = activeTool === "anchor" || event.nativeEvent.ctrlKey || pointerType === "touch";
    if (!enabled) return;
    if (pointerType === "touch") setActiveTool("anchor");
    gestureRef.current.begin(
      hit,
      event.pointerId,
      pointerType,
      event.clientX,
      event.clientY,
    );
    setPreviewHit(hit);
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  }, [activeTool, setActiveTool]);

  const handlePointerMove = useCallback((
    hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (activeTool === "anchor" || event.nativeEvent.ctrlKey) setPreviewHit(hit);
    const moved = gestureRef.current.move(hit, event.pointerId, event.clientX, event.clientY);
    if (moved) setPreviewHit(null);
  }, [activeTool]);

  const handlePointerUp = useCallback((
    _hit: SceneSurfaceHit,
    event: ThreeEvent<PointerEvent>,
  ) => {
    const result = gestureRef.current.finish(event.pointerId);
    if (result === null) return;
    (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    const enabled = activeTool === "anchor"
      || event.nativeEvent.ctrlKey
      || result.pointerType === "touch";
    if (enabled && result.hit !== null) onPlace(result.hit.position, result.hit.normal);
    if (result.pointerType === "touch") {
      setPreviewHit(null);
      setActiveTool(null);
    }
  }, [activeTool, onPlace, setActiveTool]);

  const handleControlsChange = useCallback(() => {
    gestureRef.current.markCameraMoved();
    setPreviewHit(null);
  }, []);

  const handlePointerOut = useCallback(() => {
    setPreviewHit(null);
  }, []);

  const handlePointerCancel = useCallback((event: ThreeEvent<PointerEvent>) => {
    gestureRef.current.cancel();
    setPreviewHit(null);
    if (event.nativeEvent.pointerType === "touch") setActiveTool(null);
  }, [setActiveTool]);

  return {
    handleControlsChange,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerOut,
    handlePointerUp,
    previewHit: activeTool === "anchor" ? previewHit : null,
  };
}
