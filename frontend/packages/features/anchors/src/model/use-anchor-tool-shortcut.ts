"use client";
import { useEditorTool } from "@camera-path/store";

import { useEffect, useEffectEvent } from "react";

import { useSetActiveEditorTool } from "@camera-path/actions";
import { getAnchorToolModifier } from "@camera-path/feature-anchors/lib/get-anchor-tool-modifier";

export function useAnchorToolShortcut() {
  const { activeTool } = useEditorTool();
  const setActiveTool = useSetActiveEditorTool();

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key === getAnchorToolModifier(event).key &&
      activeTool !== "anchor-height" &&
      activeTool !== "cloud"
    )
      setActiveTool("anchor");
    if (event.key === "Escape") setActiveTool(null);
  });

  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key === getAnchorToolModifier(event).key &&
      activeTool === "anchor"
    )
      setActiveTool(null);
  });

  useEffect(() => {
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
  }, [setActiveTool]);
}
