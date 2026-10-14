"use client";
import { addAnchor } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useAddAnchor(_projectId?: string) {
  return useRequestMutation(manifest, addAnchor, _projectId);
}
