"use client";

import { useEditorStore } from "./editor-store-provider";

export function useCloudPlacement() {
  const pendingCloud = useEditorStore((state) => state.tool.pendingCloud);
  const start = useEditorStore(
    (state) => state.toolActions.startCloudPlacement,
  );
  const setActiveTool = useEditorStore(
    (state) => state.toolActions.setActiveTool,
  );
  return { pendingCloud, start, cancel: () => setActiveTool(null) };
}
