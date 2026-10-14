import {
  projects_createProject,
  projects_deleteProject,
  projects_navigate,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: projectsCatalog, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [createProject, deleteProject, navigate],
    handles: [
      projects_createProject,
      projects_deleteProject,
      projects_navigate,
    ],
  },
  frames: [],
  contributions: [
    { id: "projects.content", kind: "ui", slot: "projects.content" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"projects">;
