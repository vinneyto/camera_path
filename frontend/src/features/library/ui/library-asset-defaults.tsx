"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  getGetLibraryAssetQueryKey,
  getListLibraryAssetsQueryKey,
  updateLibraryAssetDefaults,
} from "@/shared/api/generated/client";
import type { LibraryAsset } from "@/shared/api/generated/model";
import { Button, Input } from "@/shared/ui";

interface LibraryAssetDefaultsProps {
  asset: LibraryAsset;
}

export function LibraryAssetDefaults({ asset }: LibraryAssetDefaultsProps) {
  const [angles, setAngles] = useState(() =>
    asset.default_rotation_deg.map(String),
  );
  const [scale, setScale] = useState(() => String(asset.default_scale));
  const [offset, setOffset] = useState(() => asset.default_offset.map(String));
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      updateLibraryAssetDefaults(asset.id, {
        default_rotation_deg: angles.map(Number) as [number, number, number],
        default_scale: Number(scale),
        default_offset: offset.map(Number) as [number, number, number],
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListLibraryAssetsQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetLibraryAssetQueryKey(asset.id),
        }),
      ]);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form className="space-y-4 rounded-lg border p-5" onSubmit={submit}>
      <h2 className="text-sm font-semibold">Defaults for new project clouds</h2>
      <p className="text-xs text-muted-foreground">
        Default rotation: local X → Y → Z (Euler XYZ), degrees
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <label className="w-20 text-xs" key={axis}>
            {axis} (°)
            <Input
              aria-label={`${asset.name} rotation ${axis} in degrees`}
              required
              step="any"
              type="number"
              value={angles[index]}
              onChange={(event) =>
                setAngles((current) =>
                  current.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
            />
          </label>
        ))}
        <label className="w-24 text-xs">
          Uniform scale
          <Input
            aria-label={`${asset.name} uniform scale`}
            min="0.000001"
            required
            step="any"
            type="number"
            value={scale}
            onChange={(event) => setScale(event.target.value)}
          />
        </label>
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <label className="w-24 text-xs" key={`offset-${axis}`}>
            Offset {axis}
            <Input
              aria-label={`${asset.name} offset ${axis}`}
              required
              step="any"
              type="number"
              value={offset[index]}
              onChange={(event) =>
                setOffset((current) =>
                  current.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
            />
          </label>
        ))}
        <Button disabled={save.isPending} size="sm" type="submit">
          {save.isPending ? "Saving…" : "Save defaults"}
        </Button>
      </div>
      {save.error && (
        <p className="text-xs text-destructive" role="alert">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p className="text-xs" role="status">
          Saved
        </p>
      )}
    </form>
  );
}
