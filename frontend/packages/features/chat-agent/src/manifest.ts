import { chat_agent_sendChatMessage } from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: anchors, access: ["read", "readAsync", "subscribe"] },
      { contract: chatHistory, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: { calls: [sendChatMessage], handles: [chat_agent_sendChatMessage] },
  frames: [],
  contributions: [
    { id: "chat-agent.sidebar", kind: "ui", slot: "project.sidebar" },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"chat-agent">;
