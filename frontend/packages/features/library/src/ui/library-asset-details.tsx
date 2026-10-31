"use client";
import Link from "next/link";
import { EditorOnly } from "../ports/editor-only";

import { useLibraryAssetResource } from "@camera-path/api/resources";
import { LibraryAssetDefaults } from "@camera-path/feature-library/ui/library-asset-defaults";
import { LibraryAssetThumbnail } from "./library-asset-thumbnail";

interface LibraryAssetDetailsProps {
  assetId: string;
}

export function LibraryAssetDetails({ assetId }: LibraryAssetDetailsProps) {
  const asset = useLibraryAssetResource(assetId);
  const current = asset.data?.status === 200 ? asset.data.data : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
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
            <LibraryAssetThumbnail
              url={current.thumbnail_url}
              name={current.name}
            />
            <h1 className="mt-4 break-words text-xl font-semibold">
              {current.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {current.format.toUpperCase()} ·{" "}
              {(current.size_bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
              {new Date(current.created_at).toLocaleDateString()}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {current.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            {current.download_url && (
              <a
                className="mt-3 inline-block text-xs underline"
                download
                href={current.download_url}
              >
                Download
              </a>
            )}
            {current.files
              .filter(
                (file) =>
                  file.id !== current.primary_file_id && file.download_url,
              )
              .map((file) => (
                <a
                  key={file.id}
                  className="ml-3 inline-block text-xs underline"
                  download
                  href={file.download_url!}
                >
                  Download {file.format.toUpperCase()}
                </a>
              ))}
          </>
        )}
      </div>
      {current && (
        <EditorOnly>
          <LibraryAssetDefaults asset={current} />
        </EditorOnly>
      )}
    </main>
  );
}
