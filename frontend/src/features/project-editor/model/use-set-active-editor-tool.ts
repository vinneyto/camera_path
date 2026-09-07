"use client";

import { useEditorStore } from "./editor-store-provider";

export function useSetActiveEditorTool() {
  return useEditorStore((store) => store.toolActions.setActiveTool);
}
