"use client";
import { sendChatMessage } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useSendChatMessage(_projectId?: string) {
  return useRequestMutation(manifest, sendChatMessage, _projectId);
}
