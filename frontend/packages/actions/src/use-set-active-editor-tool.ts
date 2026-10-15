"use client";
import { useEditorActions } from "./actions-provider";
export function useSetActiveEditorTool() {
  return useEditorActions().setActiveTool;
}
