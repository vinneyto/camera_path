"use client";
import { createProject } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useCreateProject() {
  return useRequestMutation(manifest, createProject);
}
