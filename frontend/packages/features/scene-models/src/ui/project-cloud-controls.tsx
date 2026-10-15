"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useProjectId } from "@camera-path/store";
import { CommandPalette } from "@camera-path/ui-kit/command-palette";

import { useCloudPlacement } from "@camera-path/actions";
import { useLibraryCatalog, useSceneModels } from "@camera-path/api/resources";
import type { LibraryAsset, ProjectCloud } from "@camera-path/types/api";
import type { CommandPaletteCommand } from "@camera-path/types/commands";

import { useProjectCloudActionMutation } from "@camera-path/actions";

export function ProjectCloudControls() {
  const canEdit = useAuth().canEdit;
  const projectId = useProjectId();
  const library = useLibraryCatalog();
  const projectClouds = useSceneModels(projectId);
  const actions = useProjectCloudActionMutation(projectId);
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

  if (!canEdit) return null;
  return (
    <div className="space-y-1">
      <CommandPalette commands={commands} disabled={actions.isPending} />
      {actions.error && (
        <p role="alert" className="text-xs text-destructive">
          {actions.error.message}
        </p>
      )}
    </div>
  );
}
