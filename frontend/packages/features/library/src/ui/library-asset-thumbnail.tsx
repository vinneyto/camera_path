"use client";

import Image from "next/image";
import { Box } from "lucide-react";
import { useState } from "react";

interface LibraryAssetThumbnailProps {
  url?: string | null;
  name: string;
  large?: boolean;
}

export function LibraryAssetThumbnail({
  url,
  name,
  large = false,
}: LibraryAssetThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div
      className={
        large
          ? "flex h-80 w-full items-center justify-center overflow-hidden rounded-md bg-muted"
          : "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      }
    >
      {url && failedUrl !== url ? (
        <Image
          src={url}
          alt={`${name} preview`}
          width={large ? 518 : 64}
          height={large ? 518 : 64}
          unoptimized
          className={
            large
              ? "h-full w-full object-contain"
              : "h-full w-full object-cover"
          }
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Box className="h-6 w-6 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
