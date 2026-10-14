"use client";
import { useEditorStore } from "@host/editor/model/editor-store-provider";

export function useActiveEditorTool() {
  return useEditorStore((store) => store.tool.activeTool);
}
