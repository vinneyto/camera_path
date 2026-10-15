"use client";
import { useEditorActions } from "@camera-path/actions";

export function useSetActiveEditorTool() {
  return useEditorActions().setActiveTool;
}
