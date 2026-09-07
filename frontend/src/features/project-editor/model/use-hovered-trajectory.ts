"use client";

import { useEditorStore } from "./editor-store-provider";

export function useHoveredTrajectory() {
  const hovered = useEditorStore((store) => store.tool.hoveredObject?.type === "trajectory");
  const clearHoveredTrajectory = useEditorStore(
    (store) => store.toolActions.clearHoveredTrajectory,
  );
  const hoverTrajectory = useEditorStore((store) => store.toolActions.hoverTrajectory);
  return { clearHoveredTrajectory, hoverTrajectory, hovered };
}
