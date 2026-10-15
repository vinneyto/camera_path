"use client";
import { useEditorActions } from "@camera-path/actions";
import { useSceneInteraction } from "@camera-path/store";

import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useCallback } from "react";
export function useHoveredTrajectory() {
  const state = useSceneInteraction();
  const hover = useEditorActions().hoverObject;
  // Stable callbacks prevent cleanup/re-registration on each hover update.
  const hoverTrajectory = useCallback(
    () => void hover({ id: trajectoryObjectId }),
    [hover],
  );
  const clearHoveredTrajectory = useCallback(
    () => void hover({ id: null, ifCurrentId: trajectoryObjectId }),
    [hover],
  );
  return {
    hovered: state.hoveredObjectId === trajectoryObjectId,
    hoverTrajectory,
    clearHoveredTrajectory,
  };
}
