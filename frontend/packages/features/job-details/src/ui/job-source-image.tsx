"use client";

import Image from "next/image";
import Link from "next/link";
import type { LibraryAsset } from "@camera-path/types/api";

export function JobSourceImage({
  asset,
  active,
}: {
  asset: LibraryAsset | null;
  active: boolean;
}) {
  return (
    <section className="space-y-3" aria-labelledby="job-source-heading">
      <h2 id="job-source-heading" className="text-sm font-medium">
        Source image
      </h2>
      {asset ? (
        <Link
          href={`/library/${asset.id}`}
          className="block space-y-2 rounded-lg border p-4 hover:bg-accent/50"
        >
          {(asset.thumbnail_url || asset.download_url) && (
            <Image
              src={asset.thumbnail_url || asset.download_url!}
              alt={asset.name}
              width={518}
              height={518}
              unoptimized
              className="max-h-80 w-full object-contain"
            />
          )}
          <p className="break-words text-xs font-medium">{asset.name}</p>
          {active && (
            <p className="text-xs text-muted-foreground">
              This image cannot be deleted while generation is active.
            </p>
          )}
        </Link>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-xs text-muted-foreground">
          Source image deleted.
        </p>
      )}
    </section>
  );
}
