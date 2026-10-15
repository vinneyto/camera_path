"use client";
import { useEditorTool } from "@camera-path/store";

export function useActiveEditorTool() {
  return useEditorTool().activeTool;
}
