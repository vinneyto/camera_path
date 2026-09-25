"use client";

import Link from "next/link";

import { useListLibraryAssets } from "@/shared/api/generated/client";
import { Card } from "@/shared/ui";

export function LibraryAssetList() {
  const library = useListLibraryAssets();

  if (library.isPending)
    return <p className="text-xs text-muted-foreground">Loading library…</p>;
  if (library.error) {
    return (
      <p className="text-xs text-destructive">Could not load the library.</p>
    );
  }

  const assets = library.data?.data ?? [];
  if (!assets.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
        No files yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {assets.map((asset) => (
        <li key={asset.id}>
          <Card className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  className="block truncate text-xs font-medium hover:underline"
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
                </p>
              </div>
              {asset.download_url && (
                <a
                  className="shrink-0 text-xs underline"
                  download
                  href={asset.download_url}
                >
                  Download
                </a>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
