"use client";
import { useEditorActions } from "@camera-path/actions";
import { useEditorTool } from "@camera-path/store";

export function useCloudPlacement() {
  const state = useEditorTool();
  const start = useEditorActions().startCloudPlacement;
  const set = useEditorActions().setActiveTool;
  return {
    pendingCloud: state.pendingCloud,
    start,
    cancel: () => {
      void set(null);
    },
  };
}
