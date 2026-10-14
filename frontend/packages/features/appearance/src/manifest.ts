import { appearance_toggleTheme } from "@camera-path/contracts/feature-requests";
import { themeState } from "@camera-path/contracts/host-data";
import { toggleTheme } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "appearance",
  scope: "application",
  data: {
    provides: [],
    reads: [
      { contract: themeState, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: { calls: [toggleTheme], handles: [appearance_toggleTheme] },
  frames: [],
  contributions: [
    {
      id: "appearance.settings",
      kind: "ui",
      slot: "settings.content",
      order: 150,
    },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"appearance">;
