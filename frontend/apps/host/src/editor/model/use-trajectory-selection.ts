"use client";
import { useEditorStore } from "@host/editor/model/editor-store-provider";

export function useTrajectorySelection() {
  const state = useEditorStore((store) => store.selection);
  const actions = useEditorStore((store) => store.selectionActions);
  return { ...state, ...actions };
}
