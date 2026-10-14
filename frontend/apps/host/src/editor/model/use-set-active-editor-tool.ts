"use client";
import { useEditorStore } from "@host/editor/model/editor-store-provider";

export function useSetActiveEditorTool() {
  return useEditorStore((store) => store.toolActions.setActiveTool);
}
