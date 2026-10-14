"use client";
import { editorTool } from "@camera-path/contracts/host-data";
import {
  clearHoveredAnchor,
  hoverAnchor,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useHoveredAnchor() {
  const state = useData(manifest, editorTool);
  const clear = useRequestAction(manifest, clearHoveredAnchor);
  const hover = useRequestAction(manifest, hoverAnchor);
  return {
    hoveredAnchorId:
      state.hoveredObject?.type === "anchor" ? state.hoveredObject.id : null,
    clearHoveredAnchor: clear,
    hoverAnchor: hover,
  };
}
