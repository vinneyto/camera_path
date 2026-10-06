"use client";

import type { LibraryAsset } from "@/shared/api/generated/model";
import { Button } from "@/shared/ui";
import { useDeleteLibraryAsset } from "../api/use-delete-library-asset";

interface DeleteLibraryAssetButtonProps {
  asset: LibraryAsset;
}

export function DeleteLibraryAssetButton({
  asset,
}: DeleteLibraryAssetButtonProps) {
  const deletion = useDeleteLibraryAsset();

  function remove() {
    if (
      deletion.isPending ||
      !window.confirm(
        `Delete “${asset.name}” from the library and all projects? This action cannot be undone.`,
      )
    )
      return;
    deletion.mutate(asset.id);
  }

  return (
    <div className="relative z-20 shrink-0">
      <Button
        aria-label={`Delete ${asset.name}`}
        className="text-destructive hover:text-destructive"
        disabled={deletion.isPending}
        onClick={remove}
        size="sm"
        type="button"
        variant="ghost"
      >
        {deletion.isPending ? "Deleting…" : "Delete"}
      </Button>
      {deletion.error && (
        <p className="max-w-48 text-xs text-destructive" role="alert">
          Could not delete this library file. Please try again.
        </p>
      )}
    </div>
  );
}
