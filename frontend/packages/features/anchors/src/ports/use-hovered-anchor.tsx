"use client";
import { useEditorActions } from "@camera-path/actions";
import { useSceneInteraction } from "@camera-path/store";

import { anchorObjectId } from "@camera-path/types/anchor-object-id";
import { useCallback } from "react";
export function useHoveredAnchor() {
  const state = useSceneInteraction();
  const hover = useEditorActions().hoverObject;
  // These callbacks participate in scene effects and must retain their identity.
  const clearHoveredAnchor = useCallback(
    (id: string) => void hover({ id: null, ifCurrentId: anchorObjectId(id) }),
    [hover],
  );
  return {
    hoveredAnchorId: state.hoveredObjectId?.startsWith("anchor:")
      ? state.hoveredObjectId.slice("anchor:".length)
      : null,
    clearHoveredAnchor,
  };
}
