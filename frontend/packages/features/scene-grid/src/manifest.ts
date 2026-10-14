import { preferencesState } from "@camera-path/contracts/host-data";
import { savePreferences } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "scene-grid",
  scope: "application",
  reads: [preferencesState],
  calls: [savePreferences],
  frames: [],
  contributions: [
    { id: "scene-grid.scene", kind: "scene", slot: "scene.root", order: 20 },
    {
      id: "scene-grid.settings",
      kind: "ui",
      slot: "settings.content",
      order: 120,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"scene-grid">;
