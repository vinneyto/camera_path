import {
  anchors,
  cameraMode,
  editorTool,
  projectPermissions,
  sceneInteraction,
} from "@camera-path/contracts/host-data";
import {
  addAnchor,
  hoverObject,
  selectObject,
  deleteAnchor,
  setActiveTool,
  updateAnchor,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "anchors",
  scope: "project",
  reads: [
    projectPermissions,
    anchors,
    editorTool,
    cameraMode,
    sceneInteraction,
  ],
  calls: [
    addAnchor,
    updateAnchor,
    deleteAnchor,
    setActiveTool,
    hoverObject,
    selectObject,
  ],
  frames: [],
  contributions: [
    { id: "anchors.status", kind: "ui", slot: "project.header.status" },
    { id: "anchors.hint", kind: "ui", slot: "scene.hints" },
    { id: "anchors.scene", kind: "scene", slot: "scene.root", order: 30 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"anchors">;
