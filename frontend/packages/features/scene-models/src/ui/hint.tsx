"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useCameraModeValue, useEditorTool } from "@camera-path/store";

import { MousePointerClick } from "lucide-react";
export function CloudPlacementHint() {
  const tool = useEditorTool();
  const mode = useCameraModeValue();
  const canEdit = useAuth().canEdit;
  return canEdit && mode === "orbit" && tool.activeTool === "cloud" ? (
    <div className="pointer-events-none hidden items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur md:flex">
      <MousePointerClick className="size-3" />
      Click to place cloud on a surface (origin if no hit); press Escape to
      cancel
    </div>
  ) : null;
}
