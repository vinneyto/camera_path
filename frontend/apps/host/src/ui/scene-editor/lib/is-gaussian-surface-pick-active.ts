import type { EditorTool } from "@host/editor";

export function isGaussianSurfacePickActive(activeTool: EditorTool | null) {
  return activeTool === "anchor" || activeTool === "cloud";
}
