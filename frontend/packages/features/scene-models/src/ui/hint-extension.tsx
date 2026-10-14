"use client";
import { MousePointerClick } from "lucide-react";
import {
  cameraMode,
  editorTool,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { useData } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function HintExtension() {
  const tool = useData(manifest, editorTool);
  const mode = useData(manifest, cameraMode);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  return canEdit && mode === "orbit" && tool.activeTool === "cloud" ? (
    <div className="pointer-events-none hidden items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur md:flex">
      <MousePointerClick className="size-3" />
      Click to place cloud on a surface (origin if no hit); press Escape to
      cancel
    </div>
  ) : null;
}
