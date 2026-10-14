import {
  scene_models_projectCloudAction,
  scene_models_setActiveTool,
  scene_models_startCloudPlacement,
} from "@camera-path/contracts/feature-requests";
import {
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
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: libraryCatalog, access: ["read", "readAsync", "subscribe"] },
      { contract: sceneModels, access: ["read", "readAsync", "subscribe"] },
      { contract: editorTool, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [projectCloudAction, startCloudPlacement, setActiveTool],
    handles: [
      scene_models_projectCloudAction,
      scene_models_startCloudPlacement,
      scene_models_setActiveTool,
    ],
  },
  frames: [],
  contributions: [
    {
      id: "scene-models.commands",
      kind: "command",
      slot: "workspace.commands",
    },
    { id: "scene-models.scene", kind: "scene", slot: "scene.root", order: 10 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"scene-models">;
