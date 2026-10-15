"use client";
import { useEditorStoreApi } from "@camera-path/store";

import { useEffect } from "react";

import { useSetActiveEditorTool } from "@camera-path/actions";
import { getAnchorToolModifier } from "@camera-path/feature-anchors/lib/get-anchor-tool-modifier";

export function useAnchorToolShortcut() {
  const store = useEditorStoreApi();
  const setActiveTool = useSetActiveEditorTool();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key &&
        store.getState().tool.activeTool !== "anchor-height" &&
        store.getState().tool.activeTool !== "cloud"
      )
        setActiveTool("anchor");
      if (event.key === "Escape") setActiveTool(null);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key &&
        store.getState().tool.activeTool === "anchor"
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
      void setActiveTool(null);
    };
  }, [setActiveTool, store]);
}
