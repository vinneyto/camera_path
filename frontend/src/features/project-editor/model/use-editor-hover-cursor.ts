"use client";

import { useEffect } from "react";

import { useEditorStore } from "./editor-store-provider";

export function useEditorHoverCursor() {
  const cursor = useEditorStore((store) => {
    if (store.tool.activeTool === "anchor-height"
      || store.tool.hoveredObject?.type === "anchor") return "ns-resize";
    if (store.tool.hoveredObject?.type === "trajectory") return "pointer";
    return null;
  });

  useEffect(() => {
    if (cursor === null) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = cursor;
    return () => { document.body.style.cursor = previousCursor; };
  }, [cursor]);
}
