"use client";

import {
  useListLibraryAssets,
  useListProjectClouds,
} from "@/shared/api/generated/client";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import {
  CommandPalette,
  type CommandPaletteCommand,
} from "@/features/command-palette";

import { useProjectCloudActions } from "../api/use-project-cloud-actions";

export function ProjectCloudControls({ projectId }: { projectId: string }) {
  const library = useListLibraryAssets();
  const projectClouds = useListProjectClouds(projectId);
  const actions = useProjectCloudActions(projectId);
  const assets = ((library.data?.data ?? []) as LibraryAsset[]).filter(
    (asset) => asset.status === "ready",
  );
  const clouds = (projectClouds.data?.data ?? []) as ProjectCloud[];
  const commands: CommandPaletteCommand[] = [
    {
      id: "add-cloud",
      label: "Add cloud",
      items: assets.map((asset) => ({ id: asset.id, label: asset.name })),
      onSelectItem: (assetId) => actions.mutate({ type: "add", assetId }),
      loading: library.isPending,
      error: library.error ? "Could not load library clouds." : undefined,
      emptyMessage: "Upload a PLY to the library first.",
    },
    {
      id: "remove-cloud",
      label: "Remove cloud",
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

  return (
    <div className="space-y-1">
      <CommandPalette commands={commands} disabled={actions.isPending} />
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
