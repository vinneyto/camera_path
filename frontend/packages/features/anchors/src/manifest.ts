import {
  anchors,
  cameraMode,
  editorTool,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  addAnchor,
  clearHoveredAnchor,
  deleteAnchor,
  hoverAnchor,
  setActiveTool,
  updateAnchor,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "anchors",
  scope: "project",
  reads: [projectPermissions, anchors, editorTool, cameraMode],
  calls: [
    addAnchor,
    updateAnchor,
    deleteAnchor,
    setActiveTool,
    hoverAnchor,
    clearHoveredAnchor,
  ],
  frames: [],
  contributions: [
    { id: "anchors.scene", kind: "scene", slot: "scene.root", order: 30 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"anchors">;
