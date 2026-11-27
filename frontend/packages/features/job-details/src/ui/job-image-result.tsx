"use client";

import Image from "next/image";
import Link from "next/link";
import type { LibraryAsset } from "@camera-path/types/api";
import { Card } from "@camera-path/ui-kit";
import { ImagePreview } from "@camera-path/ui-kit/image-preview";

export function JobImageResult({ asset }: { asset: LibraryAsset }) {
  const url = asset.download_url ?? asset.thumbnail_url;
  return (
    <Card className="space-y-3 p-4">
      {url && (
        <ImagePreview name={asset.name}>
          <Image
            src={url}
            alt={asset.name}
            fill
            unoptimized
            sizes="90vw"
            className="object-contain"
          />
        </ImagePreview>
      )}
      <p className="break-words text-xs font-medium">{asset.name}</p>
      <div className="flex flex-wrap gap-3 text-xs">
        {asset.status === "ready" ? (
          <Link href={`/library/${asset.id}`} className="hover:underline">
            Open in library
          </Link>
        ) : (
          <span className="text-muted-foreground">
            Chat version · not published yet
          </span>
        )}
        {url && (
          <a href={url} download={asset.name} className="hover:underline">
            Download PNG
          </a>
        )}
      </div>
    </Card>
  );
}
