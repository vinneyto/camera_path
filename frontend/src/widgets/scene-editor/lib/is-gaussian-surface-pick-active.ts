import type { EditorTool } from "@/features/project-editor";

export function isGaussianSurfacePickActive(activeTool: EditorTool | null) {
  return activeTool === "anchor";
}
