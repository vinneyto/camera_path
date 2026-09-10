"use client";

import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Anchor } from "@/entities/project";
import {
  useActiveEditorTool,
  useHoveredAnchor,
  useSetActiveEditorTool,
} from "@/features/project-editor";

import { getWorldYAxisLift } from "../lib/get-world-y-axis-lift";

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
  const { clearHoveredAnchor, hoveredAnchorId, hoverAnchor } =
    useHoveredAnchor();
  const setActiveTool = useSetActiveEditorTool();
  const dragRef = useRef<AnchorHeightDrag | null>(null);
  const [preview, setPreview] = useState<AnchorHeightPreview | null>(null);

  const cancelDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag === null) return;
    drag.target?.releasePointerCapture?.(drag.pointerId);
    dragRef.current = null;
    setPreview(null);
    setActiveTool(null);
  }, [setActiveTool]);

  useEffect(() => {
    if (dragRef.current !== null && activeTool !== "anchor-height")
      cancelDrag();
  }, [activeTool, cancelDrag]);

  useEffect(() => {
    if (
      hoveredAnchorId !== null &&
      !anchors.some((anchor) => anchor.id === hoveredAnchorId)
    ) {
      clearHoveredAnchor(hoveredAnchorId);
    }
  }, [anchors, clearHoveredAnchor, hoveredAnchorId]);

  const handlePointerOver = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== null || event.nativeEvent.pointerType === "touch")
        return;
      event.stopPropagation();
      hoverAnchor(anchor.id);
    },
    [activeTool, hoverAnchor],
  );

  const handlePointerOut = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.pointerType === "touch") return;
      if (dragRef.current?.anchorId === anchor.id) return;
      event.stopPropagation();
      clearHoveredAnchor(anchor.id);
    },
    [clearHoveredAnchor],
  );

  const handlePointerDown = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
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
      hoverAnchor(anchor.id);
      setPreview({ anchorId: anchor.id, dragging: true, lift: anchor.lift });
      setActiveTool("anchor-height");
    },
    [activeTool, hoverAnchor, setActiveTool],
  );

  const handlePointerMove = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
      const drag = dragRef.current;
      if (drag?.anchorId !== anchor.id || drag.pointerId !== event.pointerId)
        return;
      event.stopPropagation();
      const pointerLift = getWorldYAxisLift(event.ray, anchor.surface_position);
      if (pointerLift === null) return;
      const lift = Math.max(0, pointerLift - drag.grabOffset);
      drag.lift = lift;
      setPreview({ anchorId: anchor.id, dragging: true, lift });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
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
    },
    [onCommit, setActiveTool],
  );

  const handlePointerCancel = useCallback(
    (anchor: Anchor, event: ThreeEvent<PointerEvent>) => {
      if (dragRef.current?.anchorId !== anchor.id) return;
      event.stopPropagation();
      cancelDrag();
    },
    [cancelDrag],
  );

  const activeAnchorId =
    preview?.anchorId ?? (activeTool === null ? hoveredAnchorId : null);
  const activeAnchor = useMemo(
    () => anchors.find((anchor) => anchor.id === activeAnchorId) ?? null,
    [activeAnchorId, anchors],
  );

  const getAnchorInteractionProps = useCallback(
    (anchor: Anchor): AnchorInteractionProps => ({
      onPointerCancel: (event) => handlePointerCancel(anchor, event),
      onPointerDown: (event) => handlePointerDown(anchor, event),
      onPointerMove: (event) => handlePointerMove(anchor, event),
      onPointerOut: (event) => handlePointerOut(anchor, event),
      onPointerOver: (event) => handlePointerOver(anchor, event),
      onPointerUp: (event) => handlePointerUp(anchor, event),
    }),
    [
      handlePointerCancel,
      handlePointerDown,
      handlePointerMove,
      handlePointerOut,
      handlePointerOver,
      handlePointerUp,
    ],
  );

  return {
    activeAnchor,
    getAnchorInteractionProps,
    hoveredAnchorId,
    preview,
  };
}
