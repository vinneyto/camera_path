"use client";
import { useEditorStore } from "./store-provider";
export function useCameraModeValue() {
  return useEditorStore((s) => s.camera.cameraMode);
}
