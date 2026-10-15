"use client";
import { useUpdateLibraryDefaultsMutation } from "@camera-path/actions";

import type { LibraryAsset } from "@camera-path/types/api";
import { Button, Input } from "@camera-path/ui-kit";
import { useState, type FormEvent } from "react";

interface LibraryAssetDefaultsProps {
  asset: LibraryAsset;
}

export function LibraryAssetDefaults({ asset }: LibraryAssetDefaultsProps) {
  const [angles, setAngles] = useState(() =>
    asset.default_rotation_deg.map(String),
  );
  const [scale, setScale] = useState(() => String(asset.default_scale));
  const [offset, setOffset] = useState(() => asset.default_offset.map(String));
  const save = useUpdateLibraryDefaultsMutation();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({
      assetId: asset.id,
      changes: {
        default_rotation_deg: angles.map(Number) as [number, number, number],
        default_scale: Number(scale),
        default_offset: offset.map(Number) as [number, number, number],
      },
    });
  }

  return (
    <form className="space-y-4 rounded-lg border p-5" onSubmit={submit}>
      <h2 className="text-sm font-semibold">Defaults for new project clouds</h2>
      <p className="text-xs text-muted-foreground">
        Default rotation: local X → Y → Z (Euler XYZ), degrees
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <Input
            key={axis}
            className="w-20"
            placeholder={`${axis} (°)`}
            title={`Rotation ${axis} (°)`}
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
        ))}
        <Input
          className="w-28"
          placeholder="Uniform scale"
          title="Uniform scale"
          aria-label={`${asset.name} uniform scale`}
          min="0.000001"
          required
          step="any"
          type="number"
          value={scale}
          onChange={(event) => setScale(event.target.value)}
        />
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <Input
            key={`offset-${axis}`}
            className="w-24"
            placeholder={`Offset ${axis}`}
            title={`Offset ${axis}`}
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
