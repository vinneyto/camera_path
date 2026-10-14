"use client";
import { sceneModels } from "@camera-path/contracts/host-data";
import { useDataQuery, useFeatureHost } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useListProjectClouds(projectId?: string) {
  const host = useFeatureHost(manifest);
  if (projectId && host.scopeId !== projectId)
    throw new Error("Project cloud scope mismatch");
  return useDataQuery(manifest, sceneModels);
}
