"use client";

import Image from "next/image";
import { Box } from "lucide-react";
import { useState } from "react";

interface LibraryAssetThumbnailProps {
  url?: string | null;
  name: string;
}

export function LibraryAssetThumbnail({
  url,
  name,
}: LibraryAssetThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {url && failedUrl !== url ? (
        <Image
          src={url}
          alt={`${name} preview`}
          width={64}
          height={64}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Box className="h-6 w-6 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
