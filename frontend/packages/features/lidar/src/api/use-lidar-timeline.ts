"use client";
import { setLidarTimeline } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useLidarTimeline(_projectId?: string) {
  return useRequestMutation(manifest, setLidarTimeline, _projectId);
}
