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
  const tool = useData(manifest, editorTool).activeTool;
  const mode = useData(manifest, cameraMode);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  if (!canEdit || mode !== "orbit" || tool === "cloud") return null;
  return (
    <div className="pointer-events-none hidden items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur md:flex">
      <MousePointerClick className="size-3" />
      {tool === "anchor"
        ? "Anchor tool active — release the modifier key to exit"
        : tool === "anchor-height"
          ? "Drag vertically to set anchor height; press Escape to cancel"
          : "Hold Command on macOS or Ctrl on Windows/Linux; tap on touchscreens"}
    </div>
  );
}
