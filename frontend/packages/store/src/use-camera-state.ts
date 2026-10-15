"use client";
import { useEditorStore } from "./store-provider";
export function useCameraState() {
  return useEditorStore((s) => s.camera);
}
