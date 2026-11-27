"use client";
import { useEditorStore } from "./store-provider";

export function useChatComposerState() {
  return useEditorStore((state) => state.chatComposer);
}
