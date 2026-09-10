"use client";

import { useEditorStore } from "./editor-store-provider";

export function useHoveredAnchor() {
  const hoveredAnchorId = useEditorStore((store) =>
    store.tool.hoveredObject?.type === "anchor"
      ? store.tool.hoveredObject.id
      : null,
  );
  const clearHoveredAnchor = useEditorStore(
    (store) => store.toolActions.clearHoveredAnchor,
  );
  const hoverAnchor = useEditorStore((store) => store.toolActions.hoverAnchor);
  return { clearHoveredAnchor, hoveredAnchorId, hoverAnchor };
}
