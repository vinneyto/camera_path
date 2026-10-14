"use client";
import { updateDefaultCameraOrientation } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useUpdateDefaultCameraOrientation(_projectId?: string) {
  return useRequestMutation(
    manifest,
    updateDefaultCameraOrientation,
    _projectId,
  );
}
