"use client";
import { useEditorStore } from "./store-provider";
export function usePlaybackState() {
  return useEditorStore((s) => s.playback);
}
