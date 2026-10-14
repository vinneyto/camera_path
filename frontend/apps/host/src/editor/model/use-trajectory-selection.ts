"use client";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import { useCallback } from "react";
import { useEditorStore } from "./editor-store-provider";
export function useTrajectorySelection() {
  const trajectorySelected = useEditorStore(
    (s) => s.sceneInteraction.selectedObjectId === trajectoryObjectId,
  );
  const select = useEditorStore((s) => s.sceneInteractionActions.selectObject);
  const selectTrajectory = useCallback(
    () => select({ id: trajectoryObjectId }),
    [select],
  );
  const closeTrajectory = useCallback(
    () => select({ id: null, ifCurrentId: trajectoryObjectId }),
    [select],
  );
  return { trajectorySelected, selectTrajectory, closeTrajectory };
}
