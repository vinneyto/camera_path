"use client";
import { editorTool } from "@camera-path/contracts/host-data";
import { useData } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useActiveEditorTool() {
  return useData(manifest, editorTool).activeTool;
}
