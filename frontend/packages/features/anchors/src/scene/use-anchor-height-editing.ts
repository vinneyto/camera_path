"use client";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import { useEditorActions, useSetActiveEditorTool } from "@camera-path/actions";
import type { Anchor } from "@camera-path/types/project";
import { useActiveEditorTool } from "../ports/use-active-editor-tool";
import { useHoveredAnchor } from "../ports/use-hovered-anchor";

import { getWorldYAxisLift } from "@camera-path/feature-anchors/lib/get-world-y-axis-lift";
import {
  ANCHOR_HEIGHT_DRAG_THRESHOLD_PX,
  ANCHOR_TRANSFORM_PRECISION,
} from "../constants";
import { POINTER_BUTTON } from "@camera-path/ui-kit/constants";

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
  initialLift: number;
  startX: number;
  startY: number;
  dragging: boolean;
  pointerId: number;
  target: Element | null;
  view: Window | null;
}

type AnchorInteractionProps = Pick<
  ThreeElements["group"],
  "onPointerCancel" | "onPointerDown" | "onPointerMove" | "onPointerUp"
>;

export function useAnchorHeightEditing({
  anchors,
  onCommit,
}: UseAnchorHeightEditingOptions) {
  const activeTool = useActiveEditorTool();
  const { clearHoveredAnchor, hoveredAnchorId } = useHoveredAnchor();
  const setActiveTool = useSetActiveEditorTool();
  const { referenceChatObject } = useEditorActions();
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
    if (activeTool !== "anchor-height") return;
    const drag = dragRef.current;
    const view = drag?.view;
    if (!drag || !view) return;
    // R3F clears hover on pointercancel without forwarding it to mesh handlers.
    const cancel = (event: Event) => {
      if (
        dragRef.current !== drag ||
        (event.type === "pointercancel" &&
          (event as PointerEvent).pointerId !== drag.pointerId)
      )
        return;
      drag.target?.releasePointerCapture?.(drag.pointerId);
      dragRef.current = null;
      setPreview(null);
      setActiveTool(null);
    };
    view.addEventListener("pointercancel", cancel, true);
    view.addEventListener("blur", cancel);
    return () => {
      view.removeEventListener("pointercancel", cancel, true);
      view.removeEventListener("blur", cancel);
    };
  }, [activeTool, setActiveTool]);

  useEffect(() => {
    if (
      hoveredAnchorId !== null &&
      !anchors.some((anchor) => anchor.id === hoveredAnchorId)
    ) {
      clearHoveredAnchor(hoveredAnchorId);
    }
  }, [anchors, clearHoveredAnchor, hoveredAnchorId]);

  function handlePointerDown(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    if (activeTool !== null || event.button !== POINTER_BUTTON.primary) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    const target = event.target as Element | null;
    target?.setPointerCapture?.(event.pointerId);
    const pointerLift = getWorldYAxisLift(event.ray, anchor.surface_position);
    dragRef.current = {
      anchorId: anchor.id,
      grabOffset: pointerLift === null ? 0 : pointerLift - anchor.lift,
      lift: anchor.lift,
      initialLift: anchor.lift,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      pointerId: event.pointerId,
      target,
      view:
        (event.nativeEvent.target as Element | null)?.ownerDocument
          ?.defaultView ?? null,
    };
    setActiveTool("anchor-height");
  }

  function hasDragged(drag: AnchorHeightDrag, event: ThreeEvent<PointerEvent>) {
    drag.dragging ||=
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >
      ANCHOR_HEIGHT_DRAG_THRESHOLD_PX;
    return drag.dragging;
  }

  function handlePointerMove(anchor: Anchor, event: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (drag?.anchorId !== anchor.id || drag.pointerId !== event.pointerId)
      return;
    event.stopPropagation();
    if (!hasDragged(drag, event)) return;
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
    setActiveTool(null);
    if (!hasDragged(drag, event)) {
      setPreview(null);
      referenceChatObject(anchor.label);
      return;
    }
    const lift = Number(drag.lift.toFixed(ANCHOR_TRANSFORM_PRECISION));
    if (lift === drag.initialLift) {
      setPreview(null);
      return;
    }
    setPreview({ anchorId: anchor.id, dragging: false, lift });
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
      onPointerUp: (event) => handlePointerUp(anchor, event),
    };
  }

  return {
    activeAnchor,
    getAnchorInteractionProps,
    hoveredAnchorId,
    preview,
  };
}
