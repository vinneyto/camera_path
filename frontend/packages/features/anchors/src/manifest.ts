import {
  anchors_addAnchor,
  anchors_clearHoveredAnchor,
  anchors_deleteAnchor,
  anchors_hoverAnchor,
  anchors_setActiveTool,
  anchors_updateAnchor,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: anchors, access: ["read", "readAsync", "subscribe"] },
      { contract: editorTool, access: ["read", "readAsync", "subscribe"] },
      { contract: cameraMode, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [
      addAnchor,
      updateAnchor,
      deleteAnchor,
      setActiveTool,
      hoverAnchor,
      clearHoveredAnchor,
    ],
    handles: [
      anchors_addAnchor,
      anchors_updateAnchor,
      anchors_deleteAnchor,
      anchors_setActiveTool,
      anchors_hoverAnchor,
      anchors_clearHoveredAnchor,
    ],
  },
  frames: [],
  contributions: [
    { id: "anchors.scene", kind: "scene", slot: "scene.root", order: 30 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"anchors">;
