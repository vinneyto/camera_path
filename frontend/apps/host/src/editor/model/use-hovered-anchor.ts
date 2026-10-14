"use client";
import { anchorObjectId } from "@camera-path/contracts/anchor-object-id";
import { useCallback } from "react";
import { useEditorStore } from "./editor-store-provider";
export function useHoveredAnchor() {
  const hovered = useEditorStore((s) => s.sceneInteraction.hoveredObjectId);
  const hover = useEditorStore((s) => s.sceneInteractionActions.hoverObject);
  const hoverAnchor = useCallback(
    (id: string) => hover({ id: anchorObjectId(id) }),
    [hover],
  );
  const clearHoveredAnchor = useCallback(
    (id: string) => hover({ id: null, ifCurrentId: anchorObjectId(id) }),
    [hover],
  );
  return {
    hoveredAnchorId: hovered?.startsWith("anchor:")
      ? hovered.slice("anchor:".length)
      : null,
    hoverAnchor,
    clearHoveredAnchor,
  };
}
