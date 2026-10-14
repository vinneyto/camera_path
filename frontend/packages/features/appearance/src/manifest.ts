import { themeState } from "@camera-path/contracts/host-data";
import { toggleTheme } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "appearance",
  scope: "application",
  reads: [themeState],
  calls: [toggleTheme],
  frames: [],
  contributions: [
    { id: "appearance.toggle", kind: "ui", slot: "header.controls", order: 20 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"appearance">;
