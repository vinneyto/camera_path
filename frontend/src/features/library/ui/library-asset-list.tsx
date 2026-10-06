"use client";

import { EditorOnly } from "@/features/auth";

import Link from "next/link";
import { useState } from "react";

import { useListLibraryAssets } from "@/shared/api/generated/client";
import { Card, Checkbox } from "@/shared/ui";
import { LibrarySelectionActions } from "./library-selection-actions";
import { useDeleteLibraryAssets } from "../api/use-delete-library-assets";

export function LibraryAssetList() {
  const library = useListLibraryAssets();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deletion = useDeleteLibraryAssets();

  if (library.isPending)
    return <p className="text-xs text-muted-foreground">Loading library…</p>;
  if (library.error) {
    return (
      <p className="text-xs text-destructive">Could not load the library.</p>
    );
  }

  const assets = library.data?.data ?? [];
  const selected = assets.filter((asset) => selectedIds.includes(asset.id));
  if (!assets.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
        No files yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <EditorOnly>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              disabled={deletion.isPending}
              aria-label="Select all library files"
              checked={selected.length === assets.length}
              indeterminate={
                selected.length > 0 && selected.length < assets.length
              }
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? assets.map((asset) => asset.id) : [],
                )
              }
            />
            {selected.length} selected
          </label>
          <LibrarySelectionActions
            deletion={deletion}
            selected={selected}
            onDeleted={() => setSelectedIds([])}
          />
        </div>
      </EditorOnly>
      <ul className="space-y-2">
        {assets.map((asset) => (
          <li key={asset.id}>
            <Card className="relative isolate p-3 transition-colors hover:border-primary/40 hover:bg-accent/50">
              <div className="flex items-center gap-3">
                <EditorOnly>
                  <label className="relative z-20 flex shrink-0 items-center self-stretch px-1">
                    <Checkbox
                      disabled={deletion.isPending}
                      aria-label={`Select ${asset.name}`}
                      checked={selectedIds.includes(asset.id)}
                      onChange={(event) =>
                        setSelectedIds((ids) =>
                          event.target.checked
                            ? [...ids, asset.id]
                            : ids.filter((id) => id !== asset.id),
                        )
                      }
                    />
                  </label>
                </EditorOnly>
                <div className="min-w-0">
                  <Link
                    className="block truncate text-xs font-medium after:absolute after:inset-0 after:z-10 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
                    href={`/library/${asset.id}`}
                  >
                    {asset.name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {asset.format.toUpperCase()} ·{" "}
                    {(asset.size_bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {new Date(asset.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Rotation XYZ: {asset.default_rotation_deg.join("°, ")}° ·
                    Scale: {asset.default_scale}
                    {asset.default_offset.some((value) => value !== 0) &&
                      ` · Offset XYZ: ${asset.default_offset.join(", ")}`}
                  </p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
