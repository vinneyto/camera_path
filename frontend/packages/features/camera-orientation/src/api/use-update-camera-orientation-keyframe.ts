"use client";
import { updateCameraOrientationKeyframe } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useUpdateCameraOrientationKeyframe(_projectId?: string) {
  return useRequestMutation(
    manifest,
    updateCameraOrientationKeyframe,
    _projectId,
  );
}
