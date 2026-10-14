import { preferencesState } from "@camera-path/contracts/host-data";
import {
  retryPreferences,
  savePreferences,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "renderer-preferences",
  scope: "application",
  reads: [preferencesState],
  calls: [savePreferences, retryPreferences],
  frames: [],
  contributions: [
    {
      id: "renderer-preferences.settings",
      kind: "ui",
      slot: "settings.content",
      order: 160,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"renderer-preferences">;
