"use client";
import { addDepthOfFieldKeyframe } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useAddDepthOfFieldKeyframe(_projectId?: string) {
  return useRequestMutation(manifest, addDepthOfFieldKeyframe, _projectId);
}
