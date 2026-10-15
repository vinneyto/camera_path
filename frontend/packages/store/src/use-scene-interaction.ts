"use client";
import { useEditorStore } from "./store-provider";
export function useSceneInteraction() {
  return useEditorStore((s) => s.sceneInteraction);
}
