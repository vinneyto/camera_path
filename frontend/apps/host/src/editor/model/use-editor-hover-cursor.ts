"use client";
import { useEffect } from "react";

import { useEditorStore } from "@host/editor/model/editor-store-provider";

export function useEditorHoverCursor() {
  const cursor = useEditorStore((store) => {
    if (
      store.tool.activeTool === "anchor-height" ||
      store.sceneInteraction.hoveredObjectId?.startsWith("anchor:")
    )
      return "default";
    if (store.sceneInteraction.hoveredObjectId === "trajectory")
      return "pointer";
    return null;
  });

  useEffect(() => {
    if (cursor === null) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = cursor;
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [cursor]);
}
