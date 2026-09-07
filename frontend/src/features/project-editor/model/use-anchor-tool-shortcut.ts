"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "./editor-store-provider";
import { getAnchorToolModifier } from "./get-anchor-tool-modifier";
import { useSetActiveEditorTool } from "./use-set-active-editor-tool";

export function useAnchorToolShortcut() {
  const store = useEditorStoreApi();
  const setActiveTool = useSetActiveEditorTool();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key
        && store.getState().tool.activeTool !== "anchor-height"
      ) setActiveTool("anchor");
      if (event.key === "Escape") setActiveTool(null);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (
        event.key === getAnchorToolModifier(event).key
        && store.getState().tool.activeTool === "anchor"
      ) setActiveTool(null);
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
      setActiveTool(null);
    };
  }, [setActiveTool, store]);
}
