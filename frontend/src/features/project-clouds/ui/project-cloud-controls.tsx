"use client";

import {
  useListLibraryAssets,
  useListProjectClouds,
} from "@/shared/api/generated/client";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import { useCloudPlacement, useSceneGrid } from "@/features/project-editor";
import {
  CommandPalette,
  type CommandPaletteCommand,
} from "@/features/command-palette";

import { useProjectCloudActions } from "../api/use-project-cloud-actions";

export function ProjectCloudControls({ projectId }: { projectId: string }) {
  const library = useListLibraryAssets();
  const projectClouds = useListProjectClouds(projectId);
  const actions = useProjectCloudActions(projectId);
  const placement = useCloudPlacement();
  const grid = useSceneGrid();
  const { showGrid, toggleGrid } = grid;
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
        if (clouds.length === 0 && !showGrid)
          actions.mutate({ type: "add", assetId });
        else placement.start(asset);
      },
      loading: library.isPending,
      error: library.error ? "Could not load library clouds." : undefined,
      emptyMessage: "Upload a PLY to the library first.",
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
    {
      id: "toggle-grid",
      label: showGrid ? "Grid: Hide" : "Grid: Show",
      checked: showGrid,
      onSelect: toggleGrid,
    },
  ];

  return (
    <div className="space-y-1">
      <CommandPalette
        commands={commands}
        disabled={actions.isPending || !grid.ready || grid.saving}
      />
      {grid.saving && (
        <p className="text-xs text-muted-foreground" role="status">
          Saving settings…
        </p>
      )}
      {grid.error && (
        <p className="text-xs text-destructive" role="alert">
          {grid.error.message}
        </p>
      )}
      {actions.error && (
        <p
          className="rounded border bg-background px-2 py-1 text-xs text-destructive"
          role="alert"
        >
          {actions.error.message}
        </p>
      )}
    </div>
  );
}
