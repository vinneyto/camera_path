"use client";
import { editorTool } from "@camera-path/contracts/host-data";
import {
  clearHoveredTrajectory,
  hoverTrajectory,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useHoveredTrajectory() {
  const state = useData(manifest, editorTool);
  const clear = useRequestAction(manifest, clearHoveredTrajectory);
  const hover = useRequestAction(manifest, hoverTrajectory);
  return {
    hovered: state.hoveredObject?.type === "trajectory",
    clearHoveredTrajectory: () => void clear(undefined),
    hoverTrajectory: () => void hover(undefined),
  };
}
