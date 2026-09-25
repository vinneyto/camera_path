"use client";

import Link from "next/link";

import { useGetLibraryAsset } from "@/shared/api/generated/client";
import { LibraryAssetDefaults } from "./library-asset-defaults";

interface LibraryAssetDetailsProps {
  assetId: string;
}

export function LibraryAssetDetails({ assetId }: LibraryAssetDetailsProps) {
  const asset = useGetLibraryAsset(assetId);
  const current = asset.data?.status === 200 ? asset.data.data : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <div>
        <Link
          className="text-xs text-muted-foreground hover:underline"
          href="/library"
        >
          ← Library
        </Link>
        {asset.isPending ? (
          <p className="mt-4 text-xs text-muted-foreground">Loading cloud…</p>
        ) : asset.error || current === null ? (
          <p className="mt-4 text-xs text-destructive" role="alert">
            Could not load this library cloud.
          </p>
        ) : (
          <>
            <h1 className="mt-4 break-words text-xl font-semibold">
              {current.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {current.format.toUpperCase()} ·{" "}
              {(current.size_bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
              {new Date(current.created_at).toLocaleDateString()}
            </p>
            {current.download_url && (
              <a
                className="mt-3 inline-block text-xs underline"
                download
                href={current.download_url}
              >
                Download
              </a>
            )}
          </>
        )}
      </div>
      {current && <LibraryAssetDefaults asset={current} />}
    </main>
  );
}
