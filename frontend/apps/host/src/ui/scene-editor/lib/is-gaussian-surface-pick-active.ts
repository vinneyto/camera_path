import type { EditorTool } from "@camera-path/store";

export function isGaussianSurfacePickActive(activeTool: EditorTool | null) {
  return activeTool === "anchor" || activeTool === "cloud";
}
