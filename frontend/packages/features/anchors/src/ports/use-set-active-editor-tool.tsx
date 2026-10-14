"use client";
import { setActiveTool } from "@camera-path/contracts/host-requests";
import { useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useSetActiveEditorTool() {
  return useRequestAction(manifest, setActiveTool);
}
