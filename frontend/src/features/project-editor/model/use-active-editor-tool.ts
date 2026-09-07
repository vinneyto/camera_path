"use client";

import { useEditorStore } from "./editor-store-provider";

export function useActiveEditorTool() {
  return useEditorStore((store) => store.tool.activeTool);
}
