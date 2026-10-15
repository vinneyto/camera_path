"use client";
import { useEditorActions } from "@camera-path/actions";
import { useSceneInteraction } from "@camera-path/store";

import { anchorObjectId } from "@camera-path/types/anchor-object-id";
import { useCallback } from "react";
export function useHoveredAnchor() {
  const state = useSceneInteraction();
  const hover = useEditorActions().hoverObject;
  const select = useEditorActions().selectObject;
  // These callbacks participate in scene effects and must retain their identity.
  const hoverAnchor = useCallback(
    (id: string) => void hover({ id: anchorObjectId(id) }),
    [hover],
  );
  const clearHoveredAnchor = useCallback(
    (id: string) => void hover({ id: null, ifCurrentId: anchorObjectId(id) }),
    [hover],
  );
  const selectAnchor = useCallback(
    (id: string) => void select({ id: anchorObjectId(id) }),
    [select],
  );
  const clearSelectedAnchor = useCallback(
    (id: string) => void select({ id: null, ifCurrentId: anchorObjectId(id) }),
    [select],
  );
  return {
    hoveredAnchorId: state.hoveredObjectId?.startsWith("anchor:")
      ? state.hoveredObjectId.slice("anchor:".length)
      : null,
    selectedAnchorId: state.selectedObjectId?.startsWith("anchor:")
      ? state.selectedObjectId.slice("anchor:".length)
      : null,
    hoverAnchor,
    clearHoveredAnchor,
    selectAnchor,
    clearSelectedAnchor,
  };
}
