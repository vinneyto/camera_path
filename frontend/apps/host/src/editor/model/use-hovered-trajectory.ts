"use client";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import { useCallback } from "react";
import { useEditorStore } from "./editor-store-provider";
export function useHoveredTrajectory() {
  const hovered = useEditorStore(
    (s) => s.sceneInteraction.hoveredObjectId === trajectoryObjectId,
  );
  const hover = useEditorStore((s) => s.sceneInteractionActions.hoverObject);
  const hoverTrajectory = useCallback(
    () => hover({ id: trajectoryObjectId }),
    [hover],
  );
  const clearHoveredTrajectory = useCallback(
    () => hover({ id: null, ifCurrentId: trajectoryObjectId }),
    [hover],
  );
  return { hovered, hoverTrajectory, clearHoveredTrajectory };
}
