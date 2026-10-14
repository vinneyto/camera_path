import {
  cameraMode,
  editorTool,
  libraryCatalog,
  projectPermissions,
  sceneModels,
} from "@camera-path/contracts/host-data";
import {
  projectCloudAction,
  setActiveTool,
  startCloudPlacement,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "scene-models",
  scope: "project",
  reads: [
    cameraMode,
    projectPermissions,
    libraryCatalog,
    sceneModels,
    editorTool,
  ],
  calls: [projectCloudAction, startCloudPlacement, setActiveTool],
  frames: [],
  contributions: [
    { id: "scene-models.hint", kind: "ui", slot: "scene.hints" },
    {
      id: "scene-models.commands",
      kind: "command",
      slot: "workspace.commands",
    },
    { id: "scene-models.scene", kind: "scene", slot: "scene.root", order: 10 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"scene-models">;
