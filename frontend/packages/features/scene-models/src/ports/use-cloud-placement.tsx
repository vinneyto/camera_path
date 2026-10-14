"use client";
import { editorTool } from "@camera-path/contracts/host-data";
import {
  setActiveTool,
  startCloudPlacement,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useCloudPlacement() {
  const state = useData(manifest, editorTool);
  const start = useRequestAction(manifest, startCloudPlacement);
  const set = useRequestAction(manifest, setActiveTool);
  return {
    pendingCloud: state.pendingCloud,
    start,
    cancel: () => {
      void set(null);
    },
  };
}
