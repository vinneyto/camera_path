import {
  anchors,
  chatHistory,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { sendChatMessage } from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "chat-agent",
  scope: "project",
  reads: [projectPermissions, anchors, chatHistory],
  calls: [sendChatMessage],
  frames: [],
  contributions: [
    { id: "chat-agent.sidebar", kind: "ui", slot: "project.sidebar" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"chat-agent">;
