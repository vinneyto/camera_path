"use client";
import { useEditorTool } from "@camera-path/store";
import { useEditorActions } from "./actions-provider";
export function useCloudPlacement() {
  const state = useEditorTool();
  const actions = useEditorActions();
  return {
    ...state,
    start: actions.startCloudPlacement,
    cancel: () => actions.setActiveTool(null),
  };
}
