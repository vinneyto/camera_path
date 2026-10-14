"use client";
import { anchorObjectId } from "@camera-path/contracts/anchor-object-id";
import { sceneInteraction } from "@camera-path/contracts/host-data";
import {
  hoverObject,
  selectObject,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { useCallback } from "react";
import { manifest } from "../manifest";
export function useHoveredAnchor() {
  const state = useData(manifest, sceneInteraction);
  const hover = useRequestAction(manifest, hoverObject);
  const select = useRequestAction(manifest, selectObject);
  // These callbacks participate in scene effects and must retain their identity.
  const hoverAnchor = useCallback(
    (id: string) => void hover({ id: anchorObjectId(id) }).catch(() => {}),
    [hover],
  );
  const clearHoveredAnchor = useCallback(
    (id: string) =>
      void hover({ id: null, ifCurrentId: anchorObjectId(id) }).catch(() => {}),
    [hover],
  );
  const selectAnchor = useCallback(
    (id: string) => void select({ id: anchorObjectId(id) }).catch(() => {}),
    [select],
  );
  const clearSelectedAnchor = useCallback(
    (id: string) =>
      void select({ id: null, ifCurrentId: anchorObjectId(id) }).catch(
        () => {},
      ),
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
