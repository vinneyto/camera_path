"use client";

import { useEditorStore } from "./editor-store-provider";

export function useSceneGrid() {
  const showGrid = useEditorStore((state) => state.scene.showGrid);
  const toggleGrid = useEditorStore((state) => state.sceneActions.toggleGrid);
  return { showGrid, toggleGrid };
}
