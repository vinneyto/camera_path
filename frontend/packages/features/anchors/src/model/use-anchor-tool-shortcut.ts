"use client";
import { useEffect } from "react";

import { editorTool } from "@camera-path/contracts/host-data";
import { useFeatureHost } from "@camera-path/extension-api";
import { getAnchorToolModifier } from "@camera-path/feature-anchors/lib/get-anchor-tool-modifier";
import { manifest } from "../manifest";
import { useSetActiveEditorTool } from "../ports";

export function useAnchorToolShortcut() {
  const host = useFeatureHost(manifest);
  const setActiveTool = useSetActiveEditorTool();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key &&
        host.data.read(editorTool).activeTool !== "anchor-height" &&
        host.data.read(editorTool).activeTool !== "cloud"
      )
        setActiveTool("anchor");
      if (event.key === "Escape") setActiveTool(null);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key &&
        host.data.read(editorTool).activeTool === "anchor"
      )
        setActiveTool(null);
    }

    function handleBlur() {
      setActiveTool(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      // The host may already be releasing the project scope.
      void setActiveTool(null).catch(() => {});
    };
  }, [setActiveTool, host]);
}
