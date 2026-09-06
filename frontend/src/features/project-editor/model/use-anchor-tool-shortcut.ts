"use client";

import { useEffect } from "react";

import { useEditorStore } from "./editor-store";

export function useAnchorToolShortcut() {
  const setActiveTool = useEditorStore((state) => state.setActiveTool);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Control") setActiveTool("anchor");
      if (event.key === "Escape") setActiveTool(null);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Control") setActiveTool(null);
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
  }, [setActiveTool]);
}
