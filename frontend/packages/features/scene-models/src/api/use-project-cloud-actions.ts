"use client";
import { projectCloudAction } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useProjectCloudActions(_projectId?: string) {
  return useRequestMutation(manifest, projectCloudAction, _projectId);
}
