import {
  projectPermissions,
  projectsCatalog,
} from "@camera-path/contracts/host-data";
import {
  createProject,
  deleteProject,
  navigate,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "projects",
  scope: "application",
  reads: [projectPermissions, projectsCatalog],
  calls: [createProject, deleteProject, navigate],
  frames: [],
  contributions: [
    { id: "projects.content", kind: "ui", slot: "projects.content" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"projects">;
