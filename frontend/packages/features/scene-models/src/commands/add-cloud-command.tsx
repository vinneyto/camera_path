"use client";
import { useCloudPlacement } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useLibraryCatalog } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";
import type { LibraryAsset } from "@camera-path/types/api";

export function AddCloudCommand() {
  const canEdit = useAuth().canEdit;
  const library = useLibraryCatalog();
  const placement = useCloudPlacement();
  const assets = ((library.data?.data ?? []) as LibraryAsset[]).filter(
    (asset) => asset.status === "ready",
  );
  if (!canEdit) return null;
  return (
    <Command
      id="scene-models.add-cloud"
      label="Cloud: Add"
      items={assets.map((asset) => ({ id: asset.id, label: asset.name }))}
      onSelectItem={(assetId) => {
        const asset = assets.find((item) => item.id === assetId);
        if (!asset) return;
        placement.start(asset);
      }}
      loading={library.isPending}
      error={library.error ? "Could not load library clouds." : undefined}
      emptyMessage="Upload a PLY or SOG to the library first."
    />
  );
}
