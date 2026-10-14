"use client";
import { addCameraOrientationKeyframe } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useAddCameraOrientationKeyframe(_projectId?: string) {
  return useRequestMutation(manifest, addCameraOrientationKeyframe, _projectId);
}
