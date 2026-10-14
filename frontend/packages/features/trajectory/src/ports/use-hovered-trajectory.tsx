"use client";
import { sceneInteraction } from "@camera-path/contracts/host-data";
import { hoverObject } from "@camera-path/contracts/host-requests";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { useCallback } from "react";
import { manifest } from "../manifest";
export function useHoveredTrajectory() {
  const state = useData(manifest, sceneInteraction);
  const hover = useRequestAction(manifest, hoverObject);
  // Stable callbacks prevent cleanup/re-registration on each hover update.
  const hoverTrajectory = useCallback(
    () => void hover({ id: trajectoryObjectId }).catch(() => {}),
    [hover],
  );
  const clearHoveredTrajectory = useCallback(
    () =>
      void hover({ id: null, ifCurrentId: trajectoryObjectId }).catch(() => {}),
    [hover],
  );
  return {
    hovered: state.hoveredObjectId === trajectoryObjectId,
    hoverTrajectory,
    clearHoveredTrajectory,
  };
}
