"use client";

import Link from "next/link";
import { ArrowRight, Box } from "lucide-react";
import type { LibraryAsset } from "@camera-path/types/api";
import { Card } from "@camera-path/ui-kit";

export function JobResultCard({ asset }: { asset: LibraryAsset }) {
  return (
    <Link
      href={`/library/${asset.id}`}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50">
        <Box className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{asset.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {asset.format.toUpperCase()} · {asset.files.length}{" "}
            {asset.files.length === 1 ? "file" : "files"}
          </p>
        </div>
        <ArrowRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Card>
    </Link>
  );
}
