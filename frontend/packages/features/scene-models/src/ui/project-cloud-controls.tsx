"use client";
import type { LibraryAsset, ProjectCloud } from "@camera-path/contracts/api";
import type { CommandPaletteCommand } from "@camera-path/contracts/commands";
import {
  useData,
  useFeatureHost,
  usePublishCommands,
} from "@camera-path/extension-api";
import { projectPermissions } from "@camera-path/contracts/host-data";
import { manifest } from "../manifest";
import {
  useCloudPlacement,
  useListLibraryAssets,
  useListProjectClouds,
} from "../ports";

import { useProjectCloudActions } from "@camera-path/feature-scene-models/api/use-project-cloud-actions";

export function ProjectCloudControls() {
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const projectId = useFeatureHost(manifest).scopeId;
  const library = useListLibraryAssets();
  const projectClouds = useListProjectClouds(projectId);
  const actions = useProjectCloudActions(projectId);
  const placement = useCloudPlacement();
  const assets = ((library.data?.data ?? []) as LibraryAsset[]).filter(
    (asset) => asset.status === "ready",
  );
  const clouds = (projectClouds.data?.data ?? []) as ProjectCloud[];
  const commands: CommandPaletteCommand[] = [
    {
      id: "add-cloud",
      label: "Cloud: Add",
      items: assets.map((asset) => ({ id: asset.id, label: asset.name })),
      onSelectItem: (assetId) => {
        const asset = assets.find((item) => item.id === assetId);
        if (!asset) return;
        placement.start(asset);
      },
      loading: library.isPending,
      error: library.error ? "Could not load library clouds." : undefined,
      emptyMessage: "Upload a PLY or SOG to the library first.",
    },
    {
      id: "remove-cloud",
      label: "Cloud: Remove",
      items: clouds.map((cloud, index) => ({
        id: cloud.id,
        label: `${cloud.name} · ${index + 1} · ${cloud.id.slice(0, 8)}`,
        searchText: cloud.id,
      })),
      onSelectItem: (cloudId) => actions.mutate({ type: "remove", cloudId }),
      loading: projectClouds.isPending,
      error: projectClouds.error ? "Could not load project clouds." : undefined,
      emptyMessage: "This project has no clouds yet.",
    },
  ];

  usePublishCommands(manifest, "scene-models.commands", {
    commands: canEdit ? commands : [],
    disabled: actions.isPending,
    error: actions.error?.message ?? null,
  });
  return null;
}
