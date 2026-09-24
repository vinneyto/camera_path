"use client";

import { useState } from "react";
import {
  useListLibraryAssets,
  useListProjectClouds,
} from "@/shared/api/generated/client";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import { Button } from "@/shared/ui";
import { useProjectCloudActions } from "../api/use-project-cloud-actions";

interface ProjectCloudPanelProps {
  projectId: string;
}

export function ProjectCloudPanel({ projectId }: ProjectCloudPanelProps) {
  const [selectedAsset, setSelectedAsset] = useState("");
  const library = useListLibraryAssets();
  const projectClouds = useListProjectClouds(projectId);
  const actions = useProjectCloudActions(projectId);
  const assets = (library.data?.data ?? []) as LibraryAsset[];
  const clouds = (projectClouds.data?.data ?? []) as ProjectCloud[];
  const selected = selectedAsset || assets[0]?.id || "";

  return (
    <section className="space-y-3 rounded-lg border bg-background/95 p-3 text-xs shadow-sm">
      <h2 className="font-semibold">Project clouds</h2>
      {(library.isPending || projectClouds.isPending) && <p>Loading clouds…</p>}
      {(library.error || projectClouds.error) && (
        <p className="text-destructive" role="alert">
          Could not load clouds or library.
        </p>
      )}
      {!projectClouds.isPending && !clouds.length && (
        <p className="text-muted-foreground">This project has no clouds yet.</p>
      )}
      <ol className="space-y-2">
        {clouds.map((cloud, index) => (
          <li className="flex items-center gap-1" key={cloud.id}>
            <span className="min-w-0 flex-1 truncate" title={cloud.name}>
              {cloud.name}
              {cloud.visible ? "" : " (hidden)"}
            </span>
            <Button
              aria-label={`Move ${cloud.name} up`}
              disabled={actions.isPending || index === 0}
              onClick={() =>
                actions.mutate({
                  type: "update",
                  cloudId: cloud.id,
                  changes: { position: index - 1 },
                })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              ↑
            </Button>
            <Button
              aria-label={`Move ${cloud.name} down`}
              disabled={actions.isPending || index === clouds.length - 1}
              onClick={() =>
                actions.mutate({
                  type: "update",
                  cloudId: cloud.id,
                  changes: { position: index + 1 },
                })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              ↓
            </Button>
            <Button
              aria-label={`${cloud.visible ? "Hide" : "Show"} ${cloud.name}`}
              disabled={actions.isPending}
              onClick={() =>
                actions.mutate({
                  type: "update",
                  cloudId: cloud.id,
                  changes: { visible: !cloud.visible },
                })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              {cloud.visible ? "Hide" : "Show"}
            </Button>
            <Button
              aria-label={`Remove ${cloud.name}`}
              disabled={actions.isPending}
              onClick={() =>
                actions.mutate({ type: "remove", cloudId: cloud.id })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              Remove
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <select
          aria-label="Choose a library file"
          className="min-w-0 flex-1 rounded-md border bg-background px-2"
          onChange={(event) => setSelectedAsset(event.target.value)}
          value={selected}
        >
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!selected || actions.isPending}
          onClick={() => actions.mutate({ type: "add", assetId: selected })}
          size="sm"
          type="button"
        >
          Add
        </Button>
      </div>
      {!library.isPending && !assets.length && (
        <p className="text-muted-foreground">
          Upload a PLY to the library first.
        </p>
      )}
      {actions.error && (
        <p className="text-destructive" role="alert">
          {actions.error.message}
        </p>
      )}
    </section>
  );
}
