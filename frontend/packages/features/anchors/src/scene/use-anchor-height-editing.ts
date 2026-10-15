"use client";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import type { Anchor } from "@camera-path/types/project";
import {
  useActiveEditorTool,
  useHoveredAnchor,
  useSetActiveEditorTool,
} from "../ports";

import { getWorldYAxisLift } from "@camera-path/feature-anchors/lib/get-world-y-axis-lift";

interface AnchorHeightPreview {
  anchorId: string;
  dragging: boolean;
  lift: number;
}

interface UseAnchorHeightEditingOptions {
  anchors: Anchor[];
  onCommit: (anchorId: string, lift: number) => Promise<void>;
}

interface AnchorHeightDrag {
  anchorId: string;
  grabOffset: number;
  lift: number;
  pointerId: number;
  target: Element | null;
}

type AnchorInteractionProps = Pick<
  ThreeElements["group"],
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerOut"
  | "onPointerOver"
  | "onPointerUp"
>;

export function useAnchorHeightEditing({
  anchors,
  onCommit,
}: UseAnchorHeightEditingOptions) {
  const activeTool = useActiveEditorTool();
  const {
    clearHoveredAnchor,
    hoveredAnchorId,
    hoverAnchor,
    selectedAnchorId,
    selectAnchor,
    clearSelectedAnchor,
  } = useHoveredAnchor();
  const setActiveTool = useSetActiveEditorTool();
  const dragRef = useRef<AnchorHeightDrag | null>(null);
  const [preview, setPreview] = useState<AnchorHeightPreview | null>(null);

  function cancelDrag() {
    const drag = dragRef.current;
    if (drag === null) return;
    drag.target?.releasePointerCapture?.(drag.pointerId);
    dragRef.current = null;
    setPreview(null);
    setActiveTool(null);
  }

  useEffect(() => {
    const drag = dragRef.current;
    if (drag === null || activeTool === "anchor-height") return;
    drag.target?.releasePointerCapture?.(drag.pointerId);
    dragRef.current = null;
    setPreview(null);
    setActiveTool(null);
  }, [activeTool, setActiveTool]);

  useEffect(() => {
    if (
      hoveredAnchorId !== null &&
      !anchors.some((anchor) => anchor.id === hoveredAnchorId)
    ) {
      clearHoveredAnchor(hoveredAnchorId);
    }
  }, [anchors, clearHoveredAnchor, hoveredAnchorId]);

  useEffect(() => {
    if (
      selectedAnchorId !== null &&
      !anchors.some((anchor) => anchor.id === selectedAnchorId)
    )
      clearSelectedAnchor(selectedAnchorId);
  }, [anchors, selectedAnchorId, clearSelectedAnchor]);

  function handlePointerOver(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    if (activeTool !== null || event.nativeEvent.pointerType === "touch")
      return;
    event.stopPropagation();
    hoverAnchor(anchor.id);
  }

  function handlePointerOut(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    if (event.nativeEvent.pointerType === "touch") return;
    if (dragRef.current?.anchorId === anchor.id) return;
    event.stopPropagation();
    clearHoveredAnchor(anchor.id);
  }

  function handlePointerDown(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    if (activeTool !== null || event.button !== 0) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    const target = event.target as Element | null;
    target?.setPointerCapture?.(event.pointerId);
    const pointerLift = getWorldYAxisLift(event.ray, anchor.surface_position);
    dragRef.current = {
      anchorId: anchor.id,
      grabOffset: pointerLift === null ? 0 : pointerLift - anchor.lift,
      lift: anchor.lift,
      pointerId: event.pointerId,
      target,
    };
    selectAnchor(anchor.id);
    hoverAnchor(anchor.id);
    setPreview({ anchorId: anchor.id, dragging: true, lift: anchor.lift });
    setActiveTool("anchor-height");
  }

  function handlePointerMove(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (drag?.anchorId !== anchor.id || drag.pointerId !== event.pointerId)
      return;
    event.stopPropagation();
    const pointerLift = getWorldYAxisLift(event.ray, anchor.surface_position);
    if (pointerLift === null) return;
    const lift = Math.max(0, pointerLift - drag.grabOffset);
    drag.lift = lift;
    setPreview({ anchorId: anchor.id, dragging: true, lift });
  }

  function handlePointerUp(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (drag?.anchorId !== anchor.id || drag.pointerId !== event.pointerId)
      return;
    event.stopPropagation();
    drag.target?.releasePointerCapture?.(drag.pointerId);
    dragRef.current = null;
    const lift = Number(drag.lift.toFixed(4));
    setPreview({ anchorId: anchor.id, dragging: false, lift });
    setActiveTool(null);
    void onCommit(anchor.id, lift).finally(() => {
      setPreview((current) =>
        current?.anchorId === anchor.id && !current.dragging ? null : current,
      );
    });
  }

  function handlePointerCancel(
    anchor: Anchor,
    event: ThreeEvent<PointerEvent>,
  ) {
    if (dragRef.current?.anchorId !== anchor.id) return;
    event.stopPropagation();
    cancelDrag();
  }

  const activeAnchorId =
    preview?.anchorId ?? (activeTool === null ? hoveredAnchorId : null);
  const activeAnchor =
    anchors.find((anchor) => anchor.id === activeAnchorId) ?? null;

  function getAnchorInteractionProps(anchor: Anchor): AnchorInteractionProps {
    return {
      onPointerCancel: (event) => handlePointerCancel(anchor, event),
      onPointerDown: (event) => handlePointerDown(anchor, event),
      onPointerMove: (event) => handlePointerMove(anchor, event),
      onPointerOut: (event) => handlePointerOut(anchor, event),
      onPointerOver: (event) => handlePointerOver(anchor, event),
      onPointerUp: (event) => handlePointerUp(anchor, event),
    };
  }

  return {
    activeAnchor,
    getAnchorInteractionProps,
    hoveredAnchorId,
    selectedAnchorId,
    preview,
  };
}
