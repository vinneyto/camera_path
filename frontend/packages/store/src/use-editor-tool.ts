"use client";
import { useEditorStore } from "./store-provider";
export function useEditorTool() {
  return useEditorStore((s) => s.tool);
}
