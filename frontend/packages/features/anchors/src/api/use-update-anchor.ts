"use client";
import { updateAnchor } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useUpdateAnchor(_projectId?: string) {
  return useRequestMutation(manifest, updateAnchor, _projectId);
}
